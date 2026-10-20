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
import { TREE_SESSION, liveChildOf } from './agentsTreeSeed';

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

  it('names each root by its ask with no transcript loaded, opens live, folds settled', async () => {
    mount({ id: 'u27-agents-tree-light' });

    const tree = await launches();
    expect(useAppStore.getState().transcripts).toEqual({});
    const roots = within(tree)
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-level') === '1');
    expect(roots.map((root) => root.getAttribute('aria-label'))).toEqual([
      `Auto agent, ${LIVE_BRIEF}, Running`,
      'Auto agent, Why does the Harborline cache miss on every deploy?, 3 agents, Idle',
      'Auto agent, Write the Northwind release notes for 2.4., 2 agents, Idle',
    ]);
    expect(roots.map((root) => root.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(labelsOf({ tree })).toHaveLength(13 + 2);
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

  it('opens and folds a settled tree from its row, with the arrow keys and the chevron', async () => {
    mount({ id: 'u27-agents-tree-light' });

    const tree = await launches();
    const cache = within(tree).getByRole('treeitem', { name: /Harborline cache/ });
    act(() => cache.focus());
    fireEvent.keyDown(cache, { key: 'ArrowRight' });
    expect(cache.getAttribute('aria-expanded')).toBe('true');
    expect(labelsOf({ tree })).toHaveLength(15 + 3);
    fireEvent.keyDown(cache, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Scout, Find where the cache key is built, Done',
    );
    fireEvent.keyDown(document.activeElement ?? cache, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cache);
    fireEvent.keyDown(cache, { key: 'ArrowLeft' });
    expect(cache.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(within(cache).getByTestId('spawned-fold-toggle'));
    expect(cache.getAttribute('aria-expanded')).toBe('true');
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
const NEWEST = 'Scout, Check notify-relay for duplicate retries, Queued';
const OLDEST = 'Planner, Plan the retry safe credit flow, Done';
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

  it('reads bottom up: Now, the newest child, down to the oldest, the root at the foot', async () => {
    const { container } = mount({ id: FOCUSED });

    const tree = await focusedTree();
    expect(screen.getByRole('button', { name: 'All launches' })).toBeDefined();
    const shown = visualLabelsOf({ tree });
    expect(shown).toHaveLength(13);
    expect(shown[0]).toBe(NEWEST);
    expect(shown[11]).toBe(OLDEST);
    expect(shown[12]).toBe(ROOT);
    const now = container.querySelector('[data-spawned-now]');
    const first = spawnedTreeItemsOf({ element: tree })[0];
    if (now === null || first === undefined) {
      throw new Error('no Now row or no first row');
    }
    expect(now.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(tree.querySelectorAll('[data-spawned-rail]')).toHaveLength(13);
    const foot = container.querySelector('[data-auto-limit-foot]');
    if (foot === null) {
      throw new Error('no limit foot');
    }
    expect(tree.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('moves with the arrows in screen order, Home on the newest, End on the root', async () => {
    mount({ id: FOCUSED });

    const tree = await focusedTree();
    const root = within(tree).getByRole('treeitem', { name: ROOT });
    expect(root.tabIndex).toBe(0);
    act(() => root.focus());
    fireEvent.keyDown(root, { key: 'ArrowUp' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(OLDEST);
    fireEvent.keyDown(document.activeElement ?? root, { key: 'Home' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(NEWEST);
    fireEvent.keyDown(document.activeElement ?? root, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Tester, Run the retry tests in payments-api, Queued',
    );
    fireEvent.keyDown(document.activeElement ?? root, { key: 'End' });
    expect(document.activeElement).toBe(root);
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    expect(root.getAttribute('aria-expanded')).toBe('false');
    expect(visualLabelsOf({ tree })).toEqual([`Auto agent, ${LIVE_BRIEF}, 12 agents, Running`]);
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
    const reader = within(tree).getByRole('treeitem', { name: OLDEST });
    act(() => reader.focus());

    startChild({ key: 'live-late', title: 'Trace the notify-relay retry storm' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(visualLabelsOf({ tree })[0]).toBe('Scout, Trace the notify-relay retry storm, Running');
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

    expect(visualLabelsOf({ tree })[0]).toBe('Scout, Trace the notify-relay retry storm, Running');
    expect(scroller.scrollTop).toBe(0);
  });
});
