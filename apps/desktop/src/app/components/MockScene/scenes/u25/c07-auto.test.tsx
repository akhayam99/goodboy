// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../../../features/auto/autoUserTurnPort';
import {
  registerTreeRetryPort,
  type TreeRetryPort,
} from '../../../../../features/auto/treeRetryPort';
import { MOCK_SCENES } from '../..';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  registerTreeRetryPort({ port: null });
});

type MountParams = {
  readonly id: keyof typeof U25_C07_AUTO_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U25_C07_AUTO_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const levelStack = (): HTMLElement => {
  const stack = document.querySelector<HTMLElement>('[data-level-stack]');
  if (stack === null) {
    throw new Error('no level stack');
  }
  return stack;
};

const shownLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>(
    `[data-level-layer="${levelStack().dataset.levelStack ?? ''}"]`,
  );
  if (layer === null) {
    throw new Error('no shown layer');
  }
  return layer;
};

const panel = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Agents' }, WAIT);

const autoTree = async (): Promise<HTMLElement> =>
  within(await panel()).getByRole('tree', { name: 'Auto agents' });

const treeRow = async (name: RegExp): Promise<HTMLElement> =>
  within(await autoTree()).getByRole('treeitem', { name });

describe('c07 Auto scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U25_C07_AUTO_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('c07-auto-working keeps the rail on the session and opens the Agents panel with the tree and the limit foot', async () => {
    mount({ id: 'c07-auto-working' });

    const tree = await autoTree();
    expect(levelStack().dataset.levelStack).toBe('session');
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(4);
    expect(within(await panel()).queryByRole('button', { name: /^Back to / })).toBeNull();
    const foot = within(await panel()).getByRole('region', { name: 'Limit' });
    expect(within(foot).getByRole('button', { name: 'Limit $10.00 · $5.23 left' })).toBeDefined();
    expect(screen.getByTestId('pane-toggle-spawned').getAttribute('aria-pressed')).toBe('true');
  });

  it('c07-auto-working nests the children under Auto and names each row by role, title and state', async () => {
    mount({ id: 'c07-auto-working' });

    const auto = await treeRow(/^Auto, /);
    expect(auto.getAttribute('aria-level')).toBe('1');
    expect(auto.getAttribute('aria-expanded')).toBe('true');
    const implementer = await treeRow(/^Implementer, Running$/);
    expect(implementer.getAttribute('aria-level')).toBe('2');
    expect(within(implementer).queryByText('Sonnet 5.5')).toBeNull();
    expect(await treeRow(/^Tester, Queued$/)).toBeDefined();

    fireEvent.mouseEnter(implementer);
    expect((await screen.findByRole('tooltip', undefined, WAIT)).textContent).toContain(
      'Implementer, Running',
    );
  });

  it('c07-auto-working walks the tree with the arrow keys and opens a child with Enter', async () => {
    mount({ id: 'c07-auto-working' });

    const auto = await treeRow(/^Auto, /);
    expect(auto.tabIndex).toBe(0);
    act(() => auto.focus());
    fireEvent.keyDown(auto, { key: 'ArrowRight' });
    const first = document.activeElement;
    expect(first?.getAttribute('aria-level')).toBe('2');
    fireEvent.keyDown(first ?? auto, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(auto);
    fireEvent.keyDown(auto, { key: 'End' });
    const last = document.activeElement;
    expect(last?.getAttribute('aria-label')).toMatch(/^Tester, /);
    fireEvent.keyDown(last ?? auto, { key: 'Enter' });
    expect(await screen.findByPlaceholderText('Message Tester', undefined, WAIT)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to agents' }));
    expect(await autoTree()).toBeDefined();
  });

  it('c07-auto-working keeps the center lean: no role chip, bare delegation lines, one tail', async () => {
    mount({ id: 'c07-auto-working' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    const title = screen.getByTestId('agent-header-title-row');
    expect(within(title).queryByText('Auto agent')).toBeNull();
    expect(within(title).queryByText('Experimental')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText('Delegated to')).toBeNull();
    for (const lines of screen.getAllByRole('list', { name: 'Delegations' })) {
      expect(within(lines).queryByText('Running')).toBeNull();
    }
    expect(document.querySelectorAll('[data-auto-tail]')).toHaveLength(1);
    const tail = document.querySelector<HTMLElement>('[data-auto-tail]');
    expect(tail?.textContent).toContain('Waiting for Implementer and Tester');
    expect(screen.queryByRole('button', { name: 'Mark finished' })).toBeNull();
  });

  it('c07-auto-plan asks for the plan approval in the stream with one primary', async () => {
    mount({ id: 'c07-auto-plan' });

    expect(await screen.findByText('Plan v1 needs your approval', undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve plan' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeDefined();
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
  });

  it('c07-auto-idle offers Mark finished in the header and draws no tail', async () => {
    mount({ id: 'c07-auto-idle' });

    expect(await screen.findByRole('button', { name: 'Mark finished' }, WAIT)).toBeDefined();
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
  });

  it('c07-auto-child opens the Implementer in the pane with its why, its tail and a composer', async () => {
    mount({ id: 'c07-auto-child' });

    expect(await screen.findByText(/^Why Auto chose Implementer:/, undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Started by Auto. Auto sees what you tell it.')).toBeDefined();
    expect(screen.getByPlaceholderText('Message Implementer')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open full' })).toBeDefined();
    expect(screen.getByText(/Reserved up to \$3\.00/)).toBeDefined();
    expect(screen.queryByText('Implementer · Implementer')).toBeNull();
    expect(
      screen.getAllByText('Post one credit per retry in postCredit and applyCredit.').length,
    ).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Back to agents' })).toBeDefined();
    expect(screen.getByTestId('pane-toggle-spawned').getAttribute('aria-pressed')).toBe('true');
  });

  it('a tree row and a delegation line open the child pane; the Auto row closes it', async () => {
    mount({ id: 'c07-auto-working' });

    const lists = await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    const tester = lists
      .flatMap((list) => within(list).getAllByRole('listitem'))
      .find((line) => within(line).queryByText('Tester') !== null);
    if (tester === undefined) {
      throw new Error('no Tester line');
    }
    fireEvent.click(within(tester).getByRole('button', { name: /^Open / }));
    expect(await screen.findByPlaceholderText('Message Tester', undefined, WAIT)).toBeDefined();

    fireEvent.click(screen.getByTestId('pane-toggle-spawned'));
    fireEvent.click(await treeRow(/^Implementer, /));
    expect(
      await screen.findByPlaceholderText('Message Implementer', undefined, WAIT),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Back to agents' }));
    fireEvent.click(await treeRow(/^Auto, /));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open full' })).toBeNull());
    expect(await autoTree()).toBeDefined();
  });

  it('Open full puts the child in the center and keeps the rail on the session', async () => {
    mount({ id: 'c07-auto-child' });

    fireEvent.click(await screen.findByRole('button', { name: 'Open full' }, WAIT));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open full' })).toBeNull());
    expect(levelStack().dataset.levelStack).toBe('session');
    expect(await screen.findByRole('button', { name: 'Open Auto' }, WAIT)).toBeDefined();
  });

  it('c07-auto-child-done shows what came back and says Returned to Auto', async () => {
    mount({ id: 'c07-auto-child-done' });

    expect(await screen.findByText('Returned to Auto', undefined, WAIT)).toBeDefined();
    expect(
      screen.getAllByText('Three tests added in payments-api, all pass.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('keeps the balance after two attempts')).toBeDefined();
  });

  it('c07-auto-project asks where the Implementer works and names the primary by the choice', async () => {
    mount({ id: 'c07-auto-project' });

    const ask = await screen.findByText('Where should the Implementer work?', undefined, WAIT);
    expect(ask).toBeDefined();
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
    expect(screen.getByPlaceholderText('Pick a folder, or write to Auto')).toBeDefined();
    const list = screen.getByRole('list', { name: 'Folders' });
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(1);
    expect(screen.getByText('In this session')).toBeDefined();
    expect(screen.queryByText(/, in this session/)).toBeNull();
    const actions = list.closest('[data-placement]')?.querySelector('[data-slot="form-actions"]');
    expect(actions?.textContent).toContain('Discard request');
    expect(
      screen.getByRole('button', { name: 'Discard request' }).getAttribute('data-variant'),
    ).toBe('quiet');
    expect(screen.queryByRole('button', { name: 'More request actions' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Another folder…' }));
    expect(screen.getByRole('textbox', { name: 'Type a folder name' })).toBeDefined();
    expect(list.compareDocumentPosition(actions ?? list) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole('button', { name: 'Choose a folder' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(boxes[0] ?? list);
    expect(screen.getByRole('button', { name: /^Use / })).toHaveProperty('disabled', false);
    fireEvent.click(boxes[1] ?? list);
    expect(screen.getByRole('button', { name: 'Use both' })).toBeDefined();
  });

  it('No folder, just answer tells Auto through its door and collapses the ask', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    mount({ id: 'c07-auto-project' });

    fireEvent.click(await screen.findByRole('button', { name: 'No folder, just answer' }, WAIT));

    expect(await screen.findByText('Answered: no folder', undefined, WAIT)).toBeDefined();
    expect(port).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'No folder, just answer in the chat.' }),
    );
    registerAutoUserTurnPort({ port: null });
  });

  it('c07-auto-images passes the screenshots on: the child brief names both', async () => {
    mount({ id: 'c07-auto-images' });

    const shots = await screen.findByRole('list', { name: 'Images Auto passed on' }, WAIT);
    expect(within(shots).getByText('banner-wide.png')).toBeDefined();
    expect(within(shots).getByText('banner-narrow.png')).toBeDefined();
    expect(
      screen.getByText('The banner overlaps the totals on narrow screens, see both shots.'),
    ).toBeDefined();
  });

  it('c07-auto-capped pauses at the limit with Raise to and Change limit on the tail', async () => {
    mount({ id: 'c07-auto-capped' });

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-auto-tail]');
      expect(found?.textContent).toContain('Paused at the limit: $10.00 of $10.00');
      return found;
    }, WAIT);
    if (tail === null || tail === undefined) {
      throw new Error('no tail');
    }
    expect(within(tail).getByRole('button', { name: 'Raise to $20.00' })).toBeDefined();
    fireEvent.click(within(tail).getByRole('button', { name: 'Change limit' }));
    expect(
      await screen.findByRole('dialog', { name: 'Limit for this Auto run' }, WAIT),
    ).toBeDefined();
  });

  it('c07-auto-limit-popover lists spent, reserved and turns under one Limit title', async () => {
    mount({ id: 'c07-auto-limit-popover' });

    const popover = await screen.findByRole('dialog', { name: 'Limit for this Auto run' }, WAIT);
    expect(within(popover).getByText('Spent')).toBeDefined();
    expect(within(popover).getByText('Reserved')).toBeDefined();
    expect(within(popover).getByText('Turns')).toBeDefined();
    expect(within(popover).getByRole('button', { name: 'No limit' })).toBeDefined();
  });

  it('c07-auto-working titles the Auto root with its goal and keeps View transcript in the menu', async () => {
    mount({ id: 'c07-auto-working' });

    const title = await screen.findByTestId('agent-header-title-row', undefined, WAIT);
    expect(within(title).queryByText(/^Auto$/)).toBeNull();
    expect(within(title).queryByRole('button', { name: 'View transcript' })).toBeNull();
    fireEvent.click(within(title).getByRole('button', { name: 'More agent actions' }));
    expect(await screen.findByRole('menuitem', { name: 'View transcript' }, WAIT)).toBeDefined();
  });

  it('closes the Agents panel and opens it again from the tools column, Auto agents stays selected', async () => {
    mount({ id: 'c07-auto-working' });

    await autoTree();
    const entry = within(shownLayer()).getByRole('button', { name: /Auto agents/ });
    expect(entry.getAttribute('aria-current')).toBe('page');
    expect(within(entry).getByText('Experimental')).toBeDefined();

    fireEvent.click(screen.getByTestId('pane-toggle-spawned'));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Agents' })).toBeNull(), WAIT);
    fireEvent.click(screen.getByTestId('pane-toggle-spawned'));
    expect(await autoTree()).toBeDefined();
  });

  it('c07-auto-folded folds the rail on the session and keeps the tree in the Agents panel', async () => {
    mount({ id: 'c07-auto-folded' });

    await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-session-rail]');
      expect(found?.dataset.sessionRail).toBe('session');
      expect(found?.hasAttribute('data-rail-folded')).toBe(true);
    }, WAIT);
    const implementer = await treeRow(/^Implementer, Running$/);
    expect(within(implementer).getByRole('img', { name: 'Running' })).toBeDefined();
    expect(await treeRow(/^Tester, Queued$/)).toBeDefined();
  });

  it('c07-auto-session-level keeps the Auto chat in the center with the session level shown', async () => {
    mount({ id: 'c07-auto-session-level' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('session'), WAIT);
    expect(screen.getByText('Waiting for Implementer and Tester')).toBeDefined();
  });

  it('c07-auto-idle reads Idle on the Auto row of the rail', async () => {
    mount({ id: 'c07-auto-idle' });

    expect(await treeRow(/^Auto, Idle$/)).toBeDefined();
    expect(within(await autoTree()).getAllByRole('treeitem')).toHaveLength(5);
  });

  it('c07-auto-answering shows Auto alone in the tree with the empty state', async () => {
    mount({ id: 'c07-auto-answering' });

    expect(within(await autoTree()).getAllByRole('treeitem')).toHaveLength(1);
    expect(within(await panel()).getByText('No agents started yet')).toBeDefined();
    expect(await treeRow(/^Auto, Idle$/)).toBeDefined();
  });

  it('c07-auto-answering rests after Auto answered: no Deciding tail and no Stop', async () => {
    mount({ id: 'c07-auto-answering' });

    await autoTree();
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
    expect(screen.queryByText('Deciding what to do next')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop Auto and its agents' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('c07-auto-blocked says why Auto stopped and redelivers on Retry', async () => {
    const retry = vi.fn<TreeRetryPort>(async () => ({ kind: 'retried' }));
    registerTreeRetryPort({ port: retry });
    mount({ id: 'c07-auto-blocked' });

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-auto-tail]');
      expect(found?.textContent).toContain('Blocked: Auto stopped answering before it replied.');
      return found;
    }, WAIT);
    if (tail === null || tail === undefined) {
      throw new Error('no tail');
    }
    fireEvent.click(within(tail).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1), WAIT);
    expect(within(tail).queryByRole('alert')).toBeNull();
  });

  it('c07-auto-blocked shows a refused Retry on the tail, not in a notification', async () => {
    registerTreeRetryPort({
      port: async () => ({ kind: 'refused', message: 'This conversation reached its time limit.' }),
    });
    mount({ id: 'c07-auto-blocked' });

    const retry = await screen.findByRole('button', { name: 'Retry' }, WAIT);
    fireEvent.click(retry);

    const title = await screen.findByText("Couldn't retry Auto", undefined, WAIT);
    const alert = title.closest('[role="alert"]');
    expect(alert?.closest('[data-auto-tail]')).not.toBeNull();
    expect(alert?.textContent).toContain('This conversation reached its time limit.');
  });

  it('c07-auto-stop-failed shows the failed Stop inline on the tail', async () => {
    mount({ id: 'c07-auto-stop-failed' });

    const title = await screen.findByText("Couldn't stop the Auto agents", undefined, WAIT);
    const alert = title.closest('[role="alert"]');
    expect(alert?.closest('[data-auto-tail]')).not.toBeNull();
    expect(alert?.textContent).toContain('Auto is not running yet. Stop it again in a moment.');
  });

  it('c07-auto-list lists every Auto conversation on one grid and opens one', async () => {
    mount({ id: 'c07-auto-list' });

    const list = await screen.findByRole('list', { name: 'Auto agents' }, WAIT);
    expect(screen.queryByRole('textbox', { name: 'Describe the work' })).toBeNull();
    expect(screen.queryByText('No Auto agents yet')).toBeNull();
    const header = screen.getByRole('button', { name: 'Start an auto' });
    expect(header.dataset['variant']).toBe('secondary');
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(within(list).getByText('Idle')).toBeDefined();
    expect(within(list).getByText('Done')).toBeDefined();
    expect(within(list).queryByText('Finished')).toBeNull();
    expect(levelStack().dataset.levelStack).toBe('session');

    fireEvent.click(rows[0] ?? list);
    expect(await autoTree()).toBeDefined();
    expect(levelStack().dataset.levelStack).toBe('session');
  });

  it('c07-auto-start-open shows the Auto form of the New drawer with its files, model and limit', async () => {
    mount({ id: 'c07-auto-start-open' });

    const form = await screen.findByRole('region', { name: 'Start an auto' }, WAIT);
    expect(within(form).getByRole('textbox', { name: 'Describe the work' })).toBeDefined();
    expect(screen.getByText(/^Limit \$/)).toBeDefined();
  });

  it('c07-auto-start-open at 1100 ends the drawer at the tools column, with Close and the primary in it', async () => {
    const observers = installFakeResizeObserver();
    const original = Element.prototype.getBoundingClientRect;
    const rects = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function rectOf(this: Element) {
        if (this.hasAttribute('data-drawer-edge')) {
          return new DOMRect(1056, 37, 44, 763);
        }
        if (this.querySelector(':scope > [data-drawer-main]') !== null) {
          return new DOMRect(246, 37, 854, 763);
        }
        return original.call(this);
      });
    mount({ id: 'c07-auto-start-open' });

    await screen.findByRole('region', { name: 'Start an auto' }, WAIT);
    act(() => observers.resizeAll());

    await waitFor(
      () =>
        expect(document.querySelector<HTMLElement>('aside[data-drawer-mode]')?.style.right).toBe(
          '44px',
        ),
      WAIT,
    );
    const aside = document.querySelector<HTMLElement>('aside[data-drawer-mode]');
    expect(aside?.dataset['drawerMode']).toBe('overlay');
    expect(Number.parseFloat(aside?.style.width ?? '') + 44).toBeLessThanOrEqual(854);
    const card = within(aside?.querySelector<HTMLElement>('[data-drawer-card]') ?? document.body);
    expect(card.getByRole('button', { name: 'Close' })).toBeDefined();
    expect(card.getByRole('button', { name: 'Start an auto' })).toBeDefined();
    rects.mockRestore();
  });

  it('c07-auto-start offers Start an auto in the empty state, which opens the Auto form', async () => {
    mount({ id: 'c07-auto-start' });

    expect(await screen.findByText('No Auto agents yet', undefined, WAIT)).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Describe the work' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Start an auto' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start an auto' }));

    const form = await screen.findByRole('region', { name: 'Start an auto' }, WAIT);
    expect(within(form).getByRole('textbox', { name: 'Describe the work' })).toBeDefined();
    expect(screen.getByText(/^Limit \$/)).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Start an auto' }).length).toBeGreaterThan(0);
  });
});
