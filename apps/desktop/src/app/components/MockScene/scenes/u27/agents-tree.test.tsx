// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { useAppStore } from '../../../../../store';
import { MOCK_SCENES } from '../..';
import { spawnedTreeItemsOf } from '../../../SpawnedPanel/spawnedTreeItemsOf';
import { U27_AGENTS_TREE_SCENES } from './agents-tree';
import { TREE_SESSION } from './agentsTreeSeed';
import { liveChildOf } from './testing/liveChildOf';

const WAIT = { timeout: 15_000 };
const LIVE_BRIEF = 'Make the payments-api retry safe end to end, with tests and docs.';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U27_AGENTS_TREE_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const launches = async (): Promise<HTMLElement> =>
  screen.findByRole('tree', { name: 'Launches' }, WAIT);

type TreeParams = {
  readonly tree: HTMLElement;
};

const labelsOf = ({ tree }: TreeParams): ReadonlyArray<string> =>
  within(tree)
    .getAllByRole('treeitem')
    .map((item) => item.getAttribute('aria-label') ?? '');

const visualLabelsOf = ({ tree }: TreeParams): ReadonlyArray<string> =>
  spawnedTreeItemsOf({ element: tree }).map((item) => item.getAttribute('aria-label') ?? '');

describe('the u27 Agents tree scenes', () => {
  it('registers a light and a dark shot', () => {
    expect(Object.keys(U27_AGENTS_TREE_SCENES)).toEqual([
      'u27-agents-tree-light',
      'u27-agents-tree-dark',
      'u27-agents-tree-focus-light',
      'u27-agents-tree-focus-dark',
    ]);
    for (const [id, Scene] of Object.entries(U27_AGENTS_TREE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('names each root by its ask with no transcript loaded, opens live, keeps settled helpers behind a summary line', async () => {
    mount({ id: 'u27-agents-tree-light' });

    const tree = await launches();
    expect(useAppStore.getState().transcripts).toEqual({});
    const roots = within(tree)
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-level') === '1');
    expect(roots.map((root) => root.getAttribute('aria-label'))).toEqual([
      `Auto agent, ${LIVE_BRIEF}, Running`,
      'Auto agent, Why does the Harborline cache miss on every deploy?, Idle',
      'Auto agent, Write the Northwind release notes for 2.4., Idle',
    ]);
    expect(roots.map((root) => root.getAttribute('aria-expanded'))).toEqual(['true', null, null]);
    expect(
      within(tree)
        .getAllByRole('treeitem', { name: /helpers$/ })
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['3 helpers', '2 helpers']);
    expect(labelsOf({ tree })).toHaveLength(13 + 2 + 2);
  });

  it('names every child by its title, its task sentence or its role, newest on top', async () => {
    mount({ id: 'u27-agents-tree-dark' });

    const tree = await launches();
    const live = visualLabelsOf({ tree }).slice(0, 13);
    expect(live).toEqual([
      'Scout, Check notify-relay for duplicate retries, Queued',
      'Tester, Run the retry tests in payments-api, Queued',
      'Docs, Write the retry section of the payments-api guide, Queued',
      'Implementer, Fix the applyCredit race, Running',
      'Reviewer, Review the ledger-core side, Running',
      'Reviewer, Review the payments-api side, Done',
      'Implementer 4, Done',
      'Implementer, Dedupe notify-relay webhooks by event id, Done',
      'Implementer, Insert ledger-core credits under a unique key, Done',
      'Implementer, Build the idempotency key once, Done',
      'Scout, Find every caller of postCredit in payments-api, Done',
      'Planner, Plan the retry safe credit flow, Done',
      `Auto agent, ${LIVE_BRIEF}, Running`,
    ]);
  });

  it('joins every child to its root on the rail under one Now marker', async () => {
    const { container } = mount({ id: 'u27-agents-tree-light' });

    const tree = await launches();
    expect(container.querySelectorAll('[data-spawned-now]')).toHaveLength(1);
    const rails = tree.querySelectorAll('[data-spawned-rail]');
    expect(rails).toHaveLength(labelsOf({ tree }).length);
    const root = within(tree).getAllByRole('treeitem')[0];
    expect(root?.querySelectorAll('[data-spawned-rail] path').length).toBeGreaterThan(0);
  });

  it('opens and folds a settled tree from its summary line, with the arrow keys and the click', async () => {
    mount({ id: 'u27-agents-tree-light' });

    const tree = await launches();
    const cache = within(tree).getByRole('treeitem', { name: /Harborline cache/ });
    expect(within(cache).queryByTestId('spawned-fold-toggle')).toBeNull();
    const summary = within(tree).getByRole('treeitem', { name: '3 helpers' });
    act(() => summary.focus());
    fireEvent.keyDown(summary, { key: 'ArrowRight' });
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(cache.getAttribute('aria-expanded')).toBe('true');
    expect(labelsOf({ tree })).toHaveLength(17 + 3);
    within(tree).getByRole('treeitem', {
      name: 'Scout, Find where the cache key is built, Done',
    });
    fireEvent.keyDown(summary, { key: 'ArrowLeft' });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(labelsOf({ tree })).toHaveLength(17);
    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
  });

  it.each(Object.keys(U27_AGENTS_TREE_SCENES))('%s has no accessibility violations', async (id) => {
    const { container } = mount({ id });
    await screen.findByRole('tree', {}, WAIT);
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});

const ROW_PX = 28;
const VIEWPORT_PX = 200;
const FOCUSED = 'u27-agents-tree-focus-light';
const TOP = 'Implementer, Fix the applyCredit race, Running';
const READER = 'Tester, Run the retry tests in payments-api, Queued';
const ROOT = `Auto agent, ${LIVE_BRIEF}, Running`;

const focusedTree = async (): Promise<HTMLElement> =>
  screen.findByRole('tree', { name: 'Auto agents' }, WAIT);

const scrollerOf = ({ tree }: TreeParams): HTMLElement => {
  const scroller = tree.closest<HTMLElement>('.overflow-y-auto');
  if (scroller === null) {
    throw new Error('the drawer has no scroller');
  }
  return scroller;
};

const layOut = ({ tree }: TreeParams): void => {
  const scroller = scrollerOf({ tree });
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: HTMLElement,
  ) {
    if (this === scroller) {
      return new DOMRect(0, 0, 320, VIEWPORT_PX);
    }
    const index = spawnedTreeItemsOf({ element: tree }).indexOf(this);
    if (index < 0) {
      return original.call(this);
    }
    return new DOMRect(0, ROW_PX * (index + 1) - scroller.scrollTop, 320, ROW_PX);
  });
};

type ChildParams = {
  readonly key: string;
  readonly title: string;
};

const startChild = ({ key, title }: ChildParams): void => {
  const { agent, delegation } = liveChildOf({ key, title, minute: 110 });
  act(() => {
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [TREE_SESSION.id]: [...(state.sessionPhaseRuns[TREE_SESSION.id] ?? []), agent],
      },
      autoTreeViews: {
        ...state.autoTreeViews,
        [TREE_SESSION.id]: (state.autoTreeViews[TREE_SESSION.id] ?? []).map((view, index) =>
          index === 0 ? { ...view, delegations: [...view.delegations, delegation] } : view,
        ),
      },
    }));
  });
};

describe('the focused Auto launch', () => {
  beforeEach(() => {
    const style = document.createElement('style');
    style.dataset.testScroll = '';
    style.textContent = '.overflow-y-auto { overflow-y: auto; }';
    document.head.append(style);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.querySelector('[data-test-scroll]')?.remove();
  });

  it('groups the launch by state: Working, Waiting, then Done folded, with no Now marker', async () => {
    const { container } = mount({ id: FOCUSED });

    const tree = await focusedTree();
    expect(screen.getByRole('button', { name: 'All launches' })).toBeDefined();
    expect(container.querySelector('[data-spawned-summary]')?.textContent).toBe(
      '2 working, 3 waiting, 7 done',
    );
    expect(visualLabelsOf({ tree })).toEqual([
      ROOT,
      'Working, 2',
      TOP,
      'Reviewer, Review the ledger-core side, Running',
      'Waiting, 3',
      'Scout, Check notify-relay for duplicate retries, Queued',
      READER,
      'Docs, Write the retry section of the payments-api guide, Queued',
      'Done, 7',
    ]);
    expect(
      within(tree).getByRole('treeitem', { name: 'Done, 7' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(container.querySelector('[data-spawned-now]')).toBeNull();
    expect(tree.querySelectorAll('[data-spawned-rail]')).toHaveLength(0);
    expect(container.querySelector('[data-auto-limit-foot]')).toBeNull();
  });

  it('moves with the arrows in screen order, Home on the Auto row, End on the Done group', async () => {
    mount({ id: FOCUSED });

    const tree = await focusedTree();
    const auto = within(tree).getByRole('treeitem', { name: ROOT });
    expect(auto.tabIndex).toBe(0);
    const first = within(tree).getByRole('treeitem', { name: 'Working, 2' });
    expect(first.tabIndex).toBe(-1);
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(TOP);
    fireEvent.keyDown(document.activeElement ?? first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    const done = within(tree).getByRole('treeitem', { name: 'Done, 7' });
    expect(document.activeElement).toBe(done);
    fireEvent.keyDown(done, { key: 'Home' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(ROOT);
    expect(document.activeElement).toBe(spawnedTreeItemsOf({ element: tree })[0]);
    fireEvent.keyDown(done, { key: 'End' });
    expect(document.activeElement).toBe(done);
    fireEvent.keyDown(done, { key: 'ArrowRight' });
    expect(done.getAttribute('aria-expanded')).toBe('true');
    expect(visualLabelsOf({ tree })).toHaveLength(9 + 7);
    fireEvent.keyDown(done, { key: 'ArrowLeft' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(visualLabelsOf({ tree })).toHaveLength(9);
  });

  it('takes a new live child in at the top and keeps the scroll and the focus of a reader below', async () => {
    mount({ id: FOCUSED });

    const tree = await focusedTree();
    layOut({ tree });
    const scroller = scrollerOf({ tree });
    act(() => {
      scroller.scrollTop = ROW_PX * 4;
      scroller.dispatchEvent(new Event('scroll'));
    });
    const reader = within(tree).getByRole('treeitem', { name: READER });
    act(() => reader.focus());

    startChild({ key: 'live-late', title: 'Trace the notify-relay retry storm' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(visualLabelsOf({ tree })[2]).toBe('Scout, Trace the notify-relay retry storm, Running');
    expect(scroller.scrollTop).toBe(ROW_PX * 5);
    expect(document.activeElement).toBe(reader);
  });

  it('shows the new child at once when the reader sits on Now', async () => {
    mount({ id: FOCUSED });

    const tree = await focusedTree();
    layOut({ tree });
    const scroller = scrollerOf({ tree });
    expect(scroller.scrollTop).toBe(0);

    startChild({ key: 'live-late', title: 'Trace the notify-relay retry storm' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(visualLabelsOf({ tree })[2]).toBe('Scout, Trace the notify-relay retry storm, Running');
    expect(scroller.scrollTop).toBe(0);
  });
});
