// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { brandId, type AgentId } from '@goodboy/types';
import { AgentsTreeScene } from './AgentsTreeScene';
import {
  TREE_SESSION,
  treeSeedOf,
  type ChildSpec,
  type TreeSeed,
  type TreeSpec,
} from './agentsTreeSeed';

const WAIT = { timeout: 15_000 };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const DONE = { state: 'settled', outcome: 'completed' } as const;
const RUNNING = { state: 'running', outcome: null } as const;
const QUEUED = { state: 'accepted', outcome: null } as const;

type ChildParams = {
  readonly key: string;
  readonly title: string;
  readonly minute: number;
  readonly status: Pick<ChildSpec, 'state' | 'outcome'>;
};

const childOf = ({ key, title, minute, status }: ChildParams): ChildSpec => ({
  key,
  role: 'implementer',
  ...status,
  request: { title, task: 'Do it.' },
  minute,
});

type SeedParams = {
  readonly phase: TreeSpec['phase'];
  readonly children: ReadonlyArray<ChildSpec>;
};

const seedOf = ({ phase, children }: SeedParams): TreeSeed =>
  treeSeedOf({
    trees: [
      {
        key: 'state',
        phase,
        brief: 'Make the payments-api retry safe.',
        minute: 90,
        ordinal: 3,
        children,
      },
    ],
    selectedKey: 'state',
  });

type MountParams = {
  readonly seed: TreeSeed;
};

const mount = ({ seed }: MountParams) =>
  render(
    <ToastProvider>
      <AgentsTreeScene theme="light" isFocused seed={seed} />
    </ToastProvider>,
  );

const tree = async (): Promise<HTMLElement> =>
  screen.findByRole('tree', { name: 'Auto agents' }, WAIT);

type TitleParams = {
  readonly title: string;
};

const agentIdOf = ({ seed, title }: TitleParams & MountParams): string => {
  const delegation = seed.views
    .flatMap((view) => view.delegations)
    .find((candidate) => candidate.request.title === title);
  if (delegation === undefined) {
    throw new Error(`no delegation ${title}`);
  }
  return delegation.childAgentId;
};

type SelectParams = {
  readonly agentId: string | null;
};

const select = ({ agentId }: SelectParams): void => {
  act(() => {
    useAppStore.setState((state) => ({
      selectedAgentId: {
        ...state.selectedAgentId,
        [TREE_SESSION.id]: agentId === null ? undefined : brandId<AgentId>({ value: agentId }),
      },
    }));
  });
};

type RetargetParams = TitleParams &
  MountParams & {
    readonly status: Pick<ChildSpec, 'state' | 'outcome'>;
  };

const retarget = ({ seed, title, status }: RetargetParams): void => {
  const agentId = agentIdOf({ seed, title });
  act(() => {
    useAppStore.setState((state) => ({
      autoTreeViews: {
        ...state.autoTreeViews,
        [TREE_SESSION.id]: (state.autoTreeViews[TREE_SESSION.id] ?? []).map((view) => ({
          ...view,
          delegations: view.delegations.map((delegation) =>
            delegation.childAgentId === agentId
              ? {
                  ...delegation,
                  ...status,
                  settledAt: status.state === 'settled' ? delegation.createdAt + 60_000 : null,
                }
              : delegation,
          ),
        })),
      },
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [TREE_SESSION.id]: (state.sessionPhaseRuns[TREE_SESSION.id] ?? []).map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                status: status.state === 'settled' ? 'completed' : 'running',
              }
            : agent,
        ),
      },
    }));
  });
};

type RowParams = TitleParams & {
  readonly tree: HTMLElement;
};

const rowOf = ({ tree: root, title }: RowParams): HTMLElement =>
  within(root).getByRole('treeitem', { name: new RegExp(title) });

const hasRow = ({ tree: root, title }: RowParams): boolean =>
  within(root).queryByRole('treeitem', { name: new RegExp(title) }) !== null;

const FIRST = { title: 'Plan the retry', minute: 91 };
const SECOND = { title: 'Fix the applyCredit race', minute: 92 };
const THIRD = { title: 'Review the ledger-core side', minute: 93 };

describe('the Auto agents rail grouped by state', () => {
  it('counts only the helpers: no summary and no group head without any, only the empty line', async () => {
    const { container } = mount({ seed: seedOf({ phase: 'waiting', children: [] }) });

    const root = await tree();
    expect(container.querySelector('[data-spawned-summary]')).toBeNull();
    expect(within(root).getAllByRole('treeitem')).toHaveLength(1);
    expect(root.querySelector('[data-spawned-state-head]')).toBeNull();
    screen.getByText('No agents started yet');
  });

  it('keeps every count equal to the rows under its head, with Auto outside the groups', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: DONE }),
        childOf({ ...SECOND, key: 'fix', status: RUNNING }),
      ],
    });
    const { container } = mount({ seed });

    const root = await tree();
    expect(container.querySelector('[data-spawned-summary]')?.textContent).toBe(
      '1 working, 1 done',
    );
    within(root).getByRole('treeitem', { name: 'Working, 1' });
    within(root).getByRole('treeitem', { name: 'Done, 1' });
    const working = root.querySelector('[data-spawned-state="working"]');
    expect(working?.querySelectorAll('[data-agent-id]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-agent-id]')).toHaveLength(2);
    fireEvent.click(within(root).getByRole('treeitem', { name: 'Done, 1' }));
    const settled = root.querySelector('[data-spawned-state="done"]');
    expect(settled?.querySelectorAll('[data-agent-id]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-agent-id]')).toHaveLength(3);
  });

  it('keeps a selected Done agent in view when a follow-up starts a child and Done would fold', async () => {
    const seed = seedOf({
      phase: 'done',
      children: [
        childOf({ ...FIRST, key: 'plan', status: DONE }),
        childOf({ ...SECOND, key: 'fix', status: DONE }),
      ],
    });
    mount({ seed });

    const root = await tree();
    select({ agentId: agentIdOf({ seed, ...FIRST }) });
    expect(hasRow({ tree: root, ...FIRST })).toBe(true);

    retarget({ seed, ...SECOND, status: RUNNING });

    expect(hasRow({ tree: root, ...FIRST })).toBe(true);
    within(root).getByRole('treeitem', { name: 'Done, 1' });
  });

  it('keeps a selected running child in view when it finishes while others still work', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: DONE }),
        childOf({ ...SECOND, key: 'fix', status: RUNNING }),
        childOf({ ...THIRD, key: 'review', status: RUNNING }),
      ],
    });
    mount({ seed });

    const root = await tree();
    select({ agentId: agentIdOf({ seed, ...SECOND }) });
    retarget({ seed, ...SECOND, status: DONE });

    expect(hasRow({ tree: root, ...SECOND })).toBe(true);
    const done = within(root).getByRole('treeitem', { name: /^Done, 2$/ });
    expect(done.getAttribute('aria-expanded')).toBeNull();
  });

  it('folds Done again for a selection outside it and keeps the reader choice', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: DONE }),
        childOf({ ...SECOND, key: 'fix', status: RUNNING }),
      ],
    });
    mount({ seed });

    const root = await tree();
    const done = within(root).getByRole('treeitem', { name: 'Done, 1' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(hasRow({ tree: root, ...FIRST })).toBe(false);
    fireEvent.click(done);
    expect(done.getAttribute('aria-expanded')).toBe('true');
    retarget({ seed, ...SECOND, status: RUNNING });
    expect(hasRow({ tree: root, ...FIRST })).toBe(true);
  });

  it('keeps keyboard focus on a row that changes group, and the arrows still move', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: RUNNING }),
        childOf({ ...SECOND, key: 'fix', status: RUNNING }),
        childOf({ ...THIRD, key: 'review', status: RUNNING }),
      ],
    });
    mount({ seed });

    const root = await tree();
    const row = rowOf({ tree: root, ...SECOND });
    act(() => row.focus());
    expect(document.activeElement).toBe(row);

    retarget({ seed, ...SECOND, status: { state: 'accepted', outcome: null } });

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      throw new Error('focus left the rail');
    }
    expect(active).not.toBe(document.body);
    expect(root.contains(active)).toBe(true);
    expect(active.dataset.agentId).toBe(agentIdOf({ seed, ...SECOND }));
    fireEvent.keyDown(active, { key: 'ArrowUp' });
    expect(root.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(active);
  });

  it('moves focus to the Done head when the focused row folds away into Done', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: RUNNING }),
        childOf({ ...SECOND, key: 'fix', status: RUNNING }),
      ],
    });
    mount({ seed });

    const root = await tree();
    const row = rowOf({ tree: root, ...SECOND });
    act(() => row.focus());

    retarget({ seed, ...SECOND, status: DONE });

    expect(hasRow({ tree: root, ...SECOND })).toBe(false);
    const done = within(root).getByRole('treeitem', { name: 'Done, 1' });
    expect(document.activeElement).toBe(done);
  });

  it('keeps Done folded while Auto still works, and keeps the reader choice', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: DONE }),
        childOf({ ...SECOND, key: 'fix', status: DONE }),
      ],
    });
    mount({ seed });

    const root = await tree();
    const done = within(root).getByRole('treeitem', { name: 'Done, 2' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(hasRow({ tree: root, ...FIRST })).toBe(false);
    fireEvent.click(done);
    expect(done.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(done);
    expect(done.getAttribute('aria-expanded')).toBe('false');
  });

  it('forces Done open with no fold control when Auto and every helper are done', async () => {
    const seed = seedOf({
      phase: 'done',
      children: [
        childOf({ ...FIRST, key: 'plan', status: DONE }),
        childOf({ ...SECOND, key: 'fix', status: DONE }),
      ],
    });
    mount({ seed });

    const root = await tree();
    const done = within(root).getByRole('treeitem', { name: 'Done, 2' });
    expect(done.getAttribute('aria-expanded')).toBeNull();
    expect(hasRow({ tree: root, ...FIRST })).toBe(true);
  });

  it('keeps Auto at level 1 and its first tab stop, with grouped helpers at level 2', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [childOf({ ...FIRST, key: 'plan', status: RUNNING })],
    });
    mount({ seed });

    const root = await tree();
    const auto = within(root).getByRole('treeitem', { name: /^Auto agent, / });
    expect(auto.getAttribute('aria-level')).toBe('1');
    expect(auto.tabIndex).toBe(0);
    expect(rowOf({ tree: root, ...FIRST }).getAttribute('aria-level')).toBe('2');
    expect(within(root).getByRole('treeitem', { name: 'Working, 1' }).tabIndex).toBe(-1);
  });

  it('moves focus to the Auto row when the Waiting head vanishes and no Done head exists', async () => {
    const seed = seedOf({
      phase: 'waiting',
      children: [
        childOf({ ...FIRST, key: 'plan', status: RUNNING }),
        childOf({ ...SECOND, key: 'fix', status: QUEUED }),
      ],
    });
    mount({ seed });

    const root = await tree();
    const head = within(root).getByRole('treeitem', { name: 'Waiting, 1' });
    act(() => head.focus());
    expect(document.activeElement).toBe(head);

    retarget({ seed, ...SECOND, status: RUNNING });

    expect(within(root).queryByRole('treeitem', { name: 'Waiting, 1' })).toBeNull();
    const auto = within(root).getByRole('treeitem', { name: /^Auto agent, / });
    expect(document.activeElement).toBe(auto);
    fireEvent.keyDown(auto, { key: 'ArrowDown' });
    expect(root.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(auto);
  });
});
