// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import { serializeHomeLayout } from '../layout/serializeHomeLayout';
import { HomePage } from './index';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });

const STORED = serializeHomeLayout({
  entries: [
    { id: 'spend', size: 'M' },
    { id: 'providerLimits', size: 'M' },
    { id: 'tasksInbox', size: 'M' },
    { id: 'workflowRules', size: 'M' },
  ],
});

const CELL = 100;

let store: StoryStore;
let frames: Array<() => void> = [];
let now = 1000;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  storySpies.getWorkspaceValue.mockResolvedValue(STORED);
  storySpies.setWorkspaceValue.mockResolvedValue(undefined);
  storySpies.getSetting.mockResolvedValue('1');
  storySpies.setSetting.mockResolvedValue(undefined);
  store.setState({ currentWorkspaceId: WS, boardReady: true, switchingToWorkspaceId: null });
  frames = [];
  now = 1000;
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(
    this: Element,
  ) {
    const cell = this.closest('[data-home-cell]');
    const grid = this.closest('[data-home-grid]');
    if (this.hasAttribute('data-home-grid')) {
      return new DOMRect(0, 0, 1000, 600);
    }
    if (cell !== null && grid !== null) {
      const index = Array.from(grid.querySelectorAll('[data-home-cell]')).indexOf(cell);
      return new DOMRect(index * (CELL + 10), 0, CELL, CELL);
    }
    return new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

const mount = async () => {
  render(
    <ToastProvider>
      <HomePage workspaceId={WS} />
    </ToastProvider>,
  );
  await screen.findByRole('button', { name: 'Hide Spend' });
};

const order = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-home-cell]')).map(
    (cell) => cell.dataset.homeCell ?? '',
  );

const slot = (id: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-home-slot="${id}"]`);
  if (found === null) {
    throw new Error(`no slot for ${id}`);
  }
  return found;
};

const cellOf = (id: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-home-cell="${id}"]`);
  if (found === null) {
    throw new Error(`no cell for ${id}`);
  }
  return found;
};

const centerOf = (index: number) => ({ x: index * (CELL + 10) + CELL / 2, y: CELL / 2 });

const flush = () => {
  const queued = frames;
  frames = [];
  act(() => queued.forEach((callback) => callback()));
};

const pointerMove = ({ x, y }: { readonly x: number; readonly y: number }) => {
  fireEvent.pointerMove(window, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
  flush();
};

const pointerDown = ({ id, index }: { readonly id: string; readonly index: number }) => {
  const { x, y } = centerOf(index);
  fireEvent.pointerDown(slot(id), {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
  });
};

const pointerUp = () =>
  fireEvent.pointerUp(window, { pointerId: 1, pointerType: 'mouse', button: 0 });

type Written = { readonly widgets: ReadonlyArray<{ readonly id: string; readonly size: string }> };

const writtenAt = (call: number): Written => {
  const params: unknown = storySpies.setWorkspaceValue.mock.calls.at(call)?.[0];
  if (typeof params !== 'object' || params === null || !('value' in params)) {
    throw new Error('no write at that call');
  }
  const value: unknown = params.value;
  if (typeof value !== 'string') {
    throw new Error('the write holds no text');
  }
  const parsed: Written = JSON.parse(value);
  return parsed;
};

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
};

describe('drag reorder', () => {
  it('moves a card over a neighbour, lifts it, and writes the new order once on drop', async () => {
    await mount();

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(0).x + 4, y: centerOf(0).y });

    expect(slot('tasksInbox').hasAttribute('data-lifted')).toBe(true);
    expect(cellOf('tasksInbox').querySelector('[data-home-placeholder]')).not.toBeNull();
    expect(order()).toEqual(['tasksInbox', 'spend', 'providerLimits', 'workflowRules']);
    pointerUp();
    await settle();

    expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1);
    expect(writtenAt(0).widgets.map((widget) => widget.id)).toEqual([
      'tasksInbox',
      'spend',
      'providerLimits',
      'workflowRules',
    ]);
    expect(slot('tasksInbox').hasAttribute('data-lifted')).toBe(false);
  });

  it('treats less than 6px as a click: nothing lifts, nothing is written', async () => {
    await mount();

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(2).x + 5, y: centerOf(2).y });
    pointerUp();
    await settle();

    expect(slot('tasksInbox').hasAttribute('data-lifted')).toBe(false);
    expect(order()).toEqual(['spend', 'providerLimits', 'tasksInbox', 'workflowRules']);
    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
  });

  it('never starts a drag from the hide button', async () => {
    await mount();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hide Spend' }), {
      button: 0,
      clientX: 5,
      clientY: 5,
      pointerId: 1,
      pointerType: 'mouse',
    });
    pointerMove({ x: 400, y: 5 });

    expect(slot('spend').hasAttribute('data-lifted')).toBe(false);
  });

  it('puts the order back on Escape and writes nothing', async () => {
    await mount();

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(0).x + 4, y: centerOf(0).y });
    expect(order()[0]).toBe('tasksInbox');
    fireEvent.keyDown(window, { key: 'Escape' });
    pointerUp();
    await settle();

    expect(order()).toEqual(['spend', 'providerLimits', 'tasksInbox', 'workflowRules']);
    expect(slot('tasksInbox').hasAttribute('data-lifted')).toBe(false);
    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
  });

  it('puts the order back on pointercancel and on window blur, and writes nothing', async () => {
    await mount();

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(0).x + 4, y: centerOf(0).y });
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(order()).toEqual(['spend', 'providerLimits', 'tasksInbox', 'workflowRules']);

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(0).x + 4, y: centerOf(0).y });
    fireEvent.blur(window);
    await settle();

    expect(order()).toEqual(['spend', 'providerLimits', 'tasksInbox', 'workflowRules']);
    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
  });

  it('keeps the swap guard: the same card cannot swap back at once, another card can', async () => {
    await mount();

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(1).x, y: centerOf(1).y });
    expect(order()).toEqual(['spend', 'tasksInbox', 'providerLimits', 'workflowRules']);

    now += 30;
    pointerMove({ x: centerOf(2).x, y: centerOf(2).y });
    expect(order()).toEqual(['spend', 'tasksInbox', 'providerLimits', 'workflowRules']);

    now += 30;
    pointerMove({ x: centerOf(0).x, y: centerOf(0).y });
    expect(order()).toEqual(['tasksInbox', 'spend', 'providerLimits', 'workflowRules']);

    fireEvent.keyDown(window, { key: 'Escape' });
  });

  it('swaps back with the same card once the pointer left it and 120 ms passed', async () => {
    await mount();

    pointerDown({ id: 'tasksInbox', index: 2 });
    pointerMove({ x: centerOf(1).x, y: centerOf(1).y });
    expect(order()).toEqual(['spend', 'tasksInbox', 'providerLimits', 'workflowRules']);

    pointerMove({ x: 700, y: 300 });
    now += 200;
    pointerMove({ x: centerOf(0).x, y: centerOf(0).y });

    expect(order()).toEqual(['tasksInbox', 'spend', 'providerLimits', 'workflowRules']);
    fireEvent.keyDown(window, { key: 'Escape' });
  });
});

describe('keyboard reorder', () => {
  it('grabs with Space, moves with the arrows, drops with Space, and announces each step', async () => {
    await mount();
    const grip = screen.getByRole('button', { name: 'Options for Tasks' });

    fireEvent.keyDown(grip, { key: ' ' });
    const live = screen.getByRole('status', { hidden: true });
    expect(live.textContent).toContain('Grabbed Tasks, position 3 of 4');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(order()).toEqual(['spend', 'tasksInbox', 'providerLimits', 'workflowRules']);
    expect(live.textContent).toBe('Tasks, position 2 of 4.');
    fireEvent.keyDown(window, { key: 'Home' });
    expect(order()[0]).toBe('tasksInbox');
    fireEvent.keyDown(window, { key: ' ' });
    await settle();

    expect(live.textContent).toBe('Dropped Tasks at position 1 of 4.');
    expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1);
    expect(writtenAt(0).widgets.map((widget) => widget.id)).toEqual([
      'tasksInbox',
      'spend',
      'providerLimits',
      'workflowRules',
    ]);
  });

  it('restores the order on Escape and writes nothing', async () => {
    await mount();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Options for Tasks' }), { key: ' ' });
    fireEvent.keyDown(window, { key: 'End' });
    expect(order()[3]).toBe('tasksInbox');
    fireEvent.keyDown(window, { key: 'Escape' });
    await settle();

    expect(order()).toEqual(['spend', 'providerLimits', 'tasksInbox', 'workflowRules']);
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe(
      'Cancelled. Tasks is back at position 3 of 4.',
    );
    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
  });

  it('moves one place from the card menu and undoes it', async () => {
    await mount();

    fireEvent.contextMenu(slot('providerLimits'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move later' }));

    expect(order()).toEqual(['spend', 'tasksInbox', 'providerLimits', 'workflowRules']);
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    await act(async () => {
      await store.getState().undoLastOperation({});
    });

    expect(order()).toEqual(['spend', 'providerLimits', 'tasksInbox', 'workflowRules']);
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(2));
  });
});

const spanOf = (id: string): string => cellOf(id).style.gridColumn;

describe('resize', () => {
  it('cycles S, M, L from the corner handle, writes the size, and Undo gives it back', async () => {
    await mount();
    expect(spanOf('spend')).toContain('span 2');

    fireEvent.click(screen.getByRole('button', { name: 'Resize Spend' }));
    expect(spanOf('spend')).toContain('span 4');
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    expect(writtenAt(0).widgets.find((widget) => widget.id === 'spend')?.size).toBe('L');
    await act(async () => {
      await store.getState().undoLastOperation({});
    });

    expect(spanOf('spend')).toContain('span 2');
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(2));
    expect(writtenAt(1).widgets.find((widget) => widget.id === 'spend')?.size).toBe('M');
  });

  it('steps with the arrow keys and stops at the ends', async () => {
    await mount();
    const handle = screen.getByRole('button', { name: 'Resize Spend' });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(spanOf('spend')).toContain('span 1');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(spanOf('spend')).toContain('span 1');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(spanOf('spend')).toContain('span 2');
  });

  it('offers only the sizes a card has, in the menu, and resizes from it', async () => {
    await mount();

    fireEvent.contextMenu(slot('workflowRules'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Size' }));

    await screen.findByRole('menuitemradio', { name: 'Medium' });
    expect(screen.queryByRole('menuitemradio', { name: 'Large' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Small' }));
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    expect(writtenAt(0).widgets.find((widget) => widget.id === 'workflowRules')?.size).toBe('S');
  });

  it('snaps while dragging the corner, and Escape gives the size back and writes nothing', async () => {
    await mount();
    const handle = screen.getByRole('button', { name: 'Resize Spend' });

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });
    pointerMove({ x: 900, y: 100 });
    expect(spanOf('spend')).toContain('span 4');
    fireEvent.keyDown(window, { key: 'Escape' });
    pointerUp();
    await settle();

    expect(spanOf('spend')).toContain('span 2');
    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
  });

  it('writes the snapped size when the corner is released', async () => {
    await mount();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Resize Spend' }), {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });
    pointerMove({ x: 900, y: 100 });
    pointerUp();
    await settle();

    expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1);
    expect(writtenAt(0).widgets.find((widget) => widget.id === 'spend')?.size).toBe('L');
  });

  it('never scales the content: a new size changes the frame and nothing in the card carries a scale', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Resize Spend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resize Spend' }));

    const frame = cellOf('spend');
    const content = document.querySelector<HTMLElement>('[data-home-widget="spend"]');
    expect(content).not.toBeNull();
    [frame, content, ...Array.from(content?.querySelectorAll<HTMLElement>('*') ?? [])].forEach(
      (node) => {
        expect(node?.style.transform ?? '').not.toContain('scale');
        expect(node?.style.scale ?? '').toBe('');
      },
    );
  });
});

describe('hide and show motion', () => {
  it('fades the card out first, then removes it and writes once', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          onchange: null,
          dispatchEvent: () => false,
        }) satisfies MediaQueryList,
    );
    await mount();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));

    expect(slot('spend').hasAttribute('data-leaving')).toBe(true);
    expect(order()).toContain('spend');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(179);
    });
    expect(order()).toContain('spend');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(order()).not.toContain('spend');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1);
  });

  it('fades a card in when it comes back from its pill', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show spend' }));

    expect(slot('spend').hasAttribute('data-arriving')).toBe(true);
  });
});
