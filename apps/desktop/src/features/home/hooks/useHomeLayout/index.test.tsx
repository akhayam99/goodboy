// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { dispatchWindowEvent } from '../../../../shared/lib/dispatchWindowEvent';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { HomePage } from '../../HomePage';
import { serializeHomeLayout } from '../../layout/serializeHomeLayout';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const OTHER = brandId<WorkspaceId>({ value: 'ws-northwind' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  storySpies.getWorkspaceValue.mockResolvedValue(null);
  storySpies.setWorkspaceValue.mockResolvedValue(undefined);
  storySpies.getSetting.mockResolvedValue('1');
  storySpies.setSetting.mockResolvedValue(undefined);
  store.setState({ currentWorkspaceId: WS, boardReady: true, switchingToWorkspaceId: null });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async () => {
  const view = render(
    <ToastProvider>
      <HomePage workspaceId={WS} />
    </ToastProvider>,
  );
  await screen.findByRole('button', { name: 'Hide Spend' });
  return view;
};

const card = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-home-widget="${id}"]`);

type Written = {
  readonly widgets: ReadonlyArray<{ readonly id: string; readonly size: string }>;
};

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

const writtenIds = (call: number): ReadonlyArray<string> =>
  writtenAt(call).widgets.map((widget) => widget.id);

describe('hide and the Show pills', () => {
  it('hides a card with the eye, lists it under Hidden, and writes the layout once, named by workspace', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));

    expect(card('spend')).toBeNull();
    screen.getByRole('button', { name: 'Show spend' });
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    expect(storySpies.setWorkspaceValue.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: WS,
      key: 'home.layout',
    });
    expect(writtenIds(0)).toEqual([
      'sessionsToFinish',
      'needsYou',
      'runningNow',
      'providerLimits',
      'tasksInbox',
    ]);
  });

  it('coalesces two gestures into one write', async () => {
    await mount();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Tasks' }));
    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1);
    expect(writtenIds(0)).not.toContain('tasksInbox');
    expect(writtenIds(0)).not.toContain('spend');
  });

  it('puts a card back at its place and size with Undo, and the undo is a gesture that saves', async () => {
    storySpies.getWorkspaceValue.mockResolvedValue(
      serializeHomeLayout({
        entries: [
          { id: 'spend', size: 'S' },
          { id: 'providerLimits', size: 'M' },
        ],
      }),
    );
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    await act(async () => {
      await store.getState().undoLastOperation({});
    });

    expect(card('spend')).not.toBeNull();
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(2));
    expect(writtenAt(1).widgets).toEqual([
      { id: 'spend', size: 'S' },
      { id: 'providerLimits', size: 'M' },
    ]);
  });

  it('brings a pill back as the last card at the size it had when hidden', async () => {
    storySpies.getWorkspaceValue.mockResolvedValue(
      serializeHomeLayout({
        entries: [
          { id: 'spend', size: 'S' },
          { id: 'providerLimits', size: 'M' },
        ],
      }),
    );
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show spend' }));

    expect(card('spend')).not.toBeNull();
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalled());
    expect(writtenAt(-1).widgets).toEqual([
      { id: 'providerLimits', size: 'M' },
      { id: 'spend', size: 'S' },
    ]);
  });

  it('lists the cards that were never added in catalog order, so Merged this week can be added', async () => {
    await mount();

    const tray = document.querySelector<HTMLElement>('[data-home-tray]');
    const labels = within(tray ?? document.body)
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(labels).toEqual([
      'Show merged this week',
      'Show long running',
      'Show every run',
      'Show workspace setup',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Show workspace setup' }));
    expect(card('workspaceSetup')).not.toBeNull();
  });

  it('says so when every card is hidden, and keeps the tray', async () => {
    storySpies.getWorkspaceValue.mockResolvedValue(serializeHomeLayout({ entries: [] }));
    render(
      <ToastProvider>
        <HomePage workspaceId={WS} />
      </ToastProvider>,
    );

    await screen.findByText('Nothing on Home. Show a card from the Hidden list.');
    expect(document.querySelectorAll('[data-home-widget]')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(10);
  });

  it('drops an id this build does not know and reads the stored order', async () => {
    storySpies.getWorkspaceValue.mockResolvedValue(
      JSON.stringify({
        v: 1,
        widgets: [
          { id: 'calendar', size: 'M' },
          { id: 'tasksInbox', size: 'S' },
          { id: 'spend', size: 'M' },
        ],
      }),
    );
    await mount();

    const ids = Array.from(document.querySelectorAll('[data-home-widget]')).map((node) =>
      node.getAttribute('data-home-widget'),
    );
    expect(ids).toEqual(['tasksInbox', 'spend']);
  });
});

describe('menu and palette verbs', () => {
  it('hides from the context menu', async () => {
    await mount();

    fireEvent.contextMenu(document.querySelector('[data-home-slot="spend"]') ?? document.body);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hide Spend' }));

    expect(card('spend')).toBeNull();
  });

  it('hides from the options button with the keyboard path of the menu key', async () => {
    await mount();

    fireEvent.keyDown(document.querySelector('[data-home-slot="spend"]') ?? document.body, {
      key: 'F10',
      shiftKey: true,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hide Spend' }));

    expect(card('spend')).toBeNull();
  });

  it('hides and shows from the palette verbs', async () => {
    await mount();

    act(() =>
      dispatchWindowEvent({
        name: 'goodboy:home-widget-verb',
        detail: { verb: 'hide', id: 'spend' },
      }),
    );
    expect(card('spend')).toBeNull();
    act(() =>
      dispatchWindowEvent({
        name: 'goodboy:home-widget-verb',
        detail: { verb: 'show', id: 'spend' },
      }),
    );
    expect(card('spend')).not.toBeNull();
  });
});

describe('saving', () => {
  it('keeps the layout you made when the write fails, shows Retry, and Retry writes it', async () => {
    storySpies.setWorkspaceValue.mockRejectedValueOnce(new Error('disk is full'));
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));

    await screen.findByText("Couldn't save the layout");
    expect(card('spend')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText("Couldn't save the layout")).toBeNull());
    expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(2);
    expect(card('spend')).toBeNull();
  });

  it('retries with the next gesture, and an undo after a failed write keeps what the screen shows', async () => {
    storySpies.setWorkspaceValue.mockRejectedValueOnce(new Error('disk is full'));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    await screen.findByText("Couldn't save the layout");

    await act(async () => {
      await store.getState().undoLastOperation({});
    });

    expect(card('spend')).not.toBeNull();
    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Couldn't save the layout")).toBeNull());
  });

  it('keeps an unsaved edit when another window saved, and follows it once nothing is unsaved', async () => {
    storySpies.setWorkspaceValue.mockRejectedValueOnce(new Error('disk is full'));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    await screen.findByText("Couldn't save the layout");

    act(() =>
      store.setState((state) => ({
        workspaceValues: {
          ...state.workspaceValues,
          [WS]: {
            'home.layout': serializeHomeLayout({ entries: [{ id: 'needsYou', size: 'M' }] }),
          },
        },
      })),
    );
    expect(card('providerLimits')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText("Couldn't save the layout")).toBeNull());
    act(() =>
      store.setState((state) => ({
        workspaceValues: {
          ...state.workspaceValues,
          [WS]: {
            'home.layout': serializeHomeLayout({ entries: [{ id: 'tasksInbox', size: 'M' }] }),
          },
        },
      })),
    );

    await waitFor(() => expect(card('providerLimits')).toBeNull());
    expect(card('tasksInbox')).not.toBeNull();
  });

  it('flushes a pending write when the page leaves, to the workspace of the gesture', async () => {
    const view = await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    view.unmount();

    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    expect(storySpies.setWorkspaceValue.mock.calls[0]?.[0]).toMatchObject({ workspaceId: WS });
  });

  it('writes to the workspace that was shown at the gesture, not the one shown after', async () => {
    const view = await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Spend' }));
    view.rerender(
      <ToastProvider>
        <HomePage workspaceId={OTHER} />
      </ToastProvider>,
    );

    await waitFor(() => expect(storySpies.setWorkspaceValue).toHaveBeenCalledTimes(1));
    expect(storySpies.setWorkspaceValue.mock.calls[0]?.[0]).toMatchObject({ workspaceId: WS });
  });

  it('writes nothing when nothing was done', async () => {
    await mount();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(storySpies.setWorkspaceValue).not.toHaveBeenCalled();
  });
});
