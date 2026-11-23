// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PullRequestPort } from '@goodboy/core/review-source';
import {
  brandId,
  type AgentId,
  type MountId,
  type PrCheckRun,
  type ProjectId,
  type PullRequestView,
  type SessionId,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { mergeInOrder, MERGE_WAIT, type MergeEntry, type MergeStep } from './mergeInOrder';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const WORKSPACE = aWorkspace({ name: 'Acme', slug: 'acme' });
const NOTIFY = aProject({ workspaceId: WORKSPACE.id, name: 'notify-relay' });
const LEDGER = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const HARBORLINE = aSession({
  workspaceId: WORKSPACE.id,
  id: brandId<SessionId>({ value: 's-1' }),
});
const NORTHWIND = aSession({ workspaceId: WORKSPACE.id, id: brandId<SessionId>({ value: 's-2' }) });
const CASCADIA = aSession({ workspaceId: WORKSPACE.id, id: brandId<SessionId>({ value: 's-3' }) });

const mountOf = ({ value }: { readonly value: string }): MountId => brandId<MountId>({ value });
const M76 = mountOf({ value: 'mount-76' });
const M305 = mountOf({ value: 'mount-305' });
const M418 = mountOf({ value: 'mount-418' });

const ENTRIES: ReadonlyArray<MergeEntry> = [
  { sessionId: HARBORLINE.id, mountId: M76, prNumber: 76, label: '#76' },
  { sessionId: NORTHWIND.id, mountId: M305, prNumber: 305, label: '#305' },
  { sessionId: CASCADIA.id, mountId: M418, prNumber: 418, label: '#418' },
];

type MountParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
};

const projectMountOf = ({ sessionId, mountId, projectId, name }: MountParams) => ({
  mountId,
  sessionId,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${String(mountId)}`,
  lastWorktreePath: `/worktrees/${String(mountId)}`,
  repoRoot: `/repos/${name}`,
  branch: `acme/${String(mountId)}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present' as const,
  revision: 1,
});

const run = ({ conclusion }: { readonly conclusion: PrCheckRun['conclusion'] }): PrCheckRun => ({
  name: 'ci',
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

type ViewParams = {
  readonly number: number;
  readonly overrides?: Partial<PullRequestView>;
};

const viewOf = ({ number, overrides = {} }: ViewParams): PullRequestView => ({
  host: 'github',
  number,
  title: `Change ${number}`,
  body: '',
  url: `https://github.com/acme/notify-relay/pull/${number}`,
  state: 'approved',
  isDraft: false,
  author: null,
  baseBranch: 'main',
  headBranch: `acme/${number}`,
  headSha: `sha-${number}`,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  mergedAt: null,
  mergeable: true,
  reviewDecision: 'approved',
  reviewers: [],
  resolves: [],
  checks: { read: 'ok', error: null, runs: [run({ conclusion: 'success' })] },
  files: { count: 0, first: [] },
  commits: [],
  mergeMethods: ['squash', 'merge'],
  mergeMethodReasons: {},
  ...overrides,
});

let store: StoryStore;
let reads: Record<number, Array<PullRequestView>>;
let landed: Set<number>;
let order: Array<string>;
let clock: number;

const unused = async (): Promise<never> => {
  throw new Error('not used by this test');
};

const portOf = ({ number }: { readonly number: number }): PullRequestPort => ({
  nouns: { long: 'pull request', short: 'PR', numberPrefix: '#' },
  read: async () => {
    order.push(`read ${number}`);
    const queue = reads[number] ?? [];
    const view = queue.length > 1 && !landed.has(number) ? queue.shift() : queue[0];
    if (view === undefined) {
      throw new Error('the pull request is gone');
    }
    return landed.has(number) ? { ...view, state: 'merged' } : view;
  },
  updateTitle: unused,
  updateBody: unused,
  searchReviewers: unused,
  requestReviewers: unused,
  setDraft: unused,
  merge: unused,
  close: unused,
  reopen: unused,
});

const seed = () => {
  store.setState({
    workspaces: [WORKSPACE],
    projects: [NOTIFY, LEDGER],
    sessions: [HARBORLINE, NORTHWIND, CASCADIA],
    sessionProjectMounts: {
      [HARBORLINE.id]: [
        projectMountOf({
          sessionId: HARBORLINE.id,
          mountId: M76,
          projectId: NOTIFY.id,
          name: 'notify-relay',
        }),
      ],
      [NORTHWIND.id]: [
        projectMountOf({
          sessionId: NORTHWIND.id,
          mountId: M305,
          projectId: NOTIFY.id,
          name: 'notify-relay',
        }),
      ],
      [CASCADIA.id]: [
        projectMountOf({
          sessionId: CASCADIA.id,
          mountId: M418,
          projectId: LEDGER.id,
          name: 'ledger-core',
        }),
      ],
    },
    mergePr: async (_sessionId, number, method, options) => {
      order.push(`merge ${number} ${method} ${options?.expectedHeadSha ?? ''}`);
      landed.add(number ?? 0);
    },
    rebaseBranch: async ({ mountId }) => {
      order.push(`update ${String(mountId)}`);
      return 'rebased';
    },
    resolveRebaseWithAuto: async ({ mountIds }) => {
      order.push(`lead ${mountIds.map(String).join(',')}`);
      return { kind: 'started', agentId: brandId<AgentId>({ value: 'lead-1' }) };
    },
  });
};

type TrainParams = {
  readonly entries?: ReadonlyArray<MergeEntry>;
  readonly shouldStop?: () => boolean;
  readonly onStep?: (step: MergeStep) => void;
  readonly portFor?: Parameters<typeof mergeInOrder>[0]['portFor'];
};

const train = ({ entries = ENTRIES, shouldStop, onStep, portFor }: TrainParams = {}) =>
  mergeInOrder({
    get: store.getState,
    portFor: portFor ?? (({ prNumber }) => portOf({ number: prNumber ?? 0 })),
    sleep: async ({ ms }) => {
      order.push('wait');
      clock += ms;
    },
    now: () => clock,
  })({
    entries,
    method: 'squash',
    shouldUpdate: true,
    shouldWait: true,
    shouldHandConflicts: true,
    ...(shouldStop === undefined ? {} : { shouldStop }),
    ...(onStep === undefined ? {} : { onStep }),
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  order = [];
  landed = new Set();
  clock = 0;
  reads = {
    76: [viewOf({ number: 76 })],
    305: [viewOf({ number: 305 })],
    418: [viewOf({ number: 418 })],
  };
  seed();
});

describe('merge in order across sessions', () => {
  it('merges each pull request in the order given with the method named on the button', async () => {
    expect(
      await train({ entries: [ENTRIES[0], ENTRIES[2]].flatMap((entry) => entry ?? []) }),
    ).toEqual({
      kind: 'done',
      merged: 2,
    });
    expect(order).toEqual([
      'read 76',
      'merge 76 squash sha-76',
      'read 76',
      'read 418',
      'merge 418 squash sha-418',
      'read 418',
    ]);
  });

  it('updates the next branch of the same repository on main and waits for its checks', async () => {
    reads[305] = [
      viewOf({ number: 305 }),
      viewOf({
        number: 305,
        overrides: {
          headSha: 'sha-305b',
          checks: { read: 'ok', error: null, runs: [run({ conclusion: 'pending' })] },
        },
      }),
      viewOf({ number: 305, overrides: { headSha: 'sha-305b' } }),
    ];
    const steps: Array<string> = [];

    const result = await train({
      entries: ENTRIES.slice(0, 2),
      onStep: ({ kind, index }) => steps.push(`${kind} ${index}`),
    });

    expect(result).toEqual({ kind: 'done', merged: 2 });
    expect(order).toEqual([
      'read 76',
      'merge 76 squash sha-76',
      'read 76',
      'read 305',
      'update mount-305',
      'read 305',
      'wait',
      'read 305',
      'merge 305 squash sha-305b',
      'read 305',
    ]);
    expect(steps).toEqual(['merging 0', 'updating 1', 'merging 1', 'waiting 1']);
  });

  it('never updates a branch whose repository did not move', async () => {
    await train({ entries: [ENTRIES[0], ENTRIES[2]].flatMap((entry) => entry ?? []) });
    expect(order.some((line) => line.startsWith('update'))).toBe(false);
  });

  it('waits for checks that have not started yet after an update, however long they take', async () => {
    const empty = viewOf({
      number: 305,
      overrides: { checks: { read: 'ok', error: null, runs: [] } },
    });
    reads[305] = [viewOf({ number: 305 }), empty, empty, empty, empty, viewOf({ number: 305 })];
    await train({ entries: ENTRIES.slice(0, 2) });
    expect(order.slice(3)).toEqual([
      'read 305',
      'update mount-305',
      'read 305',
      'wait',
      'read 305',
      'wait',
      'read 305',
      'wait',
      'read 305',
      'wait',
      'read 305',
      'merge 305 squash sha-305',
      'read 305',
    ]);
  });

  it('merges without waiting after an update when the repository runs no checks', async () => {
    reads[305] = [
      viewOf({ number: 305, overrides: { checks: { read: 'ok', error: null, runs: [] } } }),
    ];
    expect(await train({ entries: ENTRIES.slice(0, 2) })).toEqual({ kind: 'done', merged: 2 });
    expect(order).not.toContain('wait');
  });

  it('updates the next branch onto the base its pull request targets', async () => {
    const ontos: Array<string> = [];
    reads[305] = [viewOf({ number: 305, overrides: { baseBranch: 'release/2.4' } })];
    store.setState({
      rebaseBranch: async ({ ontoBranch }) => {
        ontos.push(ontoBranch ?? 'saved base');
        return 'rebased';
      },
    });
    await train({ entries: ENTRIES.slice(0, 2) });
    expect(ontos).toEqual(['release/2.4']);
  });

  it('stops at a stacked pull request that still targets the branch merged before it', async () => {
    reads[305] = [viewOf({ number: 305, overrides: { baseBranch: 'acme/76' } })];
    expect(await train({ entries: ENTRIES.slice(0, 2) })).toEqual({
      kind: 'stopped',
      merged: 1,
      index: 1,
      stop: 'stacked',
      reason: '#305 still targets acme/76, which merged before it',
      isWithLead: false,
    });
    expect(order.slice(3)).toEqual(['read 305']);
  });

  it('reads the next pull request first and never updates one closed meanwhile', async () => {
    reads[305] = [viewOf({ number: 305, overrides: { state: 'closed' } })];
    expect(await train({ entries: ENTRIES.slice(0, 2) })).toMatchObject({
      kind: 'stopped',
      merged: 1,
      stop: 'closed',
      reason: '#305 is closed',
    });
    expect(order.slice(3)).toEqual(['read 305']);
  });

  it('stops when the update dismissed the approval and merges nothing past it', async () => {
    reads[305] = [
      viewOf({ number: 305 }),
      viewOf({ number: 305, overrides: { reviewDecision: 'review_required' } }),
    ];
    expect(await train({ entries: ENTRIES.slice(0, 2) })).toMatchObject({
      kind: 'stopped',
      merged: 1,
      stop: 'review-required',
      reason: '#305 still needs an approving review',
    });
    expect(order).not.toContain('merge 305 squash sha-305');
  });

  it('stops when the host queued the merge instead of landing it, before the next branch', async () => {
    store.setState({
      mergePr: async (_sessionId, number) => {
        order.push(`merge ${number}`);
      },
    });
    expect(await train({ entries: ENTRIES.slice(0, 2) })).toEqual({
      kind: 'stopped',
      merged: 0,
      index: 0,
      stop: 'queued',
      reason: '#76 is queued to merge and has not landed yet',
      isWithLead: false,
    });
    expect(order).toEqual(['read 76', 'merge 76', 'read 76']);
  });

  it('does not say the Lead has a conflict it found no local rebase for', async () => {
    reads[76] = [viewOf({ number: 76, overrides: { mergeable: false } })];
    store.setState({
      rebaseBranch: async () => 'conflict',
      resolveRebaseWithAuto: async () => ({ kind: 'nothing' }),
    });
    expect(await train()).toEqual({
      kind: 'stopped',
      merged: 0,
      index: 0,
      stop: 'conflict',
      reason: '#76 has conflicts on its host and no local rebase for the Lead to take',
      isWithLead: false,
    });
  });

  it('stops at the first conflict and hands it to the Lead without merging past it', async () => {
    store.setState({
      rebaseBranch: async ({ mountId }) => {
        order.push(`update ${String(mountId)}`);
        return 'conflict';
      },
    });

    const result = await train();

    expect(result).toEqual({
      kind: 'stopped',
      merged: 1,
      index: 1,
      stop: 'conflict',
      reason: '#305 has conflicts. The Lead has it',
      isWithLead: true,
    });
    expect(order).toEqual([
      'read 76',
      'merge 76 squash sha-76',
      'read 76',
      'read 305',
      'update mount-305',
      'lead mount-305',
    ]);
  });

  it('rebases a pull request that already conflicts and hands a failed rebase to the Lead', async () => {
    reads[76] = [viewOf({ number: 76, overrides: { mergeable: false } })];
    store.setState({
      rebaseBranch: async () => 'conflict',
    });

    const result = await train();

    expect(result).toMatchObject({
      kind: 'stopped',
      merged: 0,
      stop: 'conflict',
      isWithLead: true,
    });
    expect(order).toEqual(['read 76', 'lead mount-76']);
  });

  it('says so when the Lead could not take the conflict', async () => {
    store.setState({
      rebaseBranch: async () => 'conflict',
      resolveRebaseWithAuto: async () => {
        throw new Error('No Lead model is set');
      },
    });

    const result = await train({ entries: ENTRIES.slice(0, 2) });

    expect(result).toMatchObject({ kind: 'stopped', merged: 1, isWithLead: false });
    expect(result.kind === 'stopped' ? result.reason : '').toContain('No Lead model is set');
  });

  it('finishes the pull request in flight and stops after it', async () => {
    let isStopRequested = false;
    store.setState({
      mergePr: async (_sessionId, number) => {
        order.push(`merge ${number}`);
        landed.add(number ?? 0);
        isStopRequested = true;
      },
    });

    const result = await train({ shouldStop: () => isStopRequested });

    expect(result).toEqual({ kind: 'halted', merged: 1 });
    expect(order).toEqual(['read 76', 'merge 76', 'read 76']);
  });

  it('stops when checks are still running after the wait limit', async () => {
    reads[76] = [
      viewOf({
        number: 76,
        overrides: { checks: { read: 'ok', error: null, runs: [run({ conclusion: 'pending' })] } },
      }),
    ];

    const result = await train();

    expect(result).toMatchObject({
      kind: 'stopped',
      merged: 0,
      stop: 'timeout',
      reason: '#76 still has checks running',
    });
    expect(order.filter((line) => line === 'wait')).toHaveLength(
      MERGE_WAIT.maxMs / MERGE_WAIT.pollMs,
    );
  });

  it.each([
    ['closed', { state: 'closed' as const }, '#76 is closed'],
    ['draft', { isDraft: true }, '#76 is still a draft'],
    [
      'changes-requested',
      { reviewDecision: 'changes_requested' as const },
      '#76 has changes requested',
    ],
    [
      'review-required',
      { reviewDecision: 'review_required' as const },
      '#76 still needs an approving review',
    ],
    [
      'unreadable-checks',
      { checks: { read: 'failed' as const, error: 'HTTP 502', runs: [] } },
      "#76 has checks Goodboy can't read",
    ],
    [
      'failing',
      { checks: { read: 'ok' as const, error: null, runs: [run({ conclusion: 'failure' })] } },
      '#76 has failing checks',
    ],
    [
      'method',
      { mergeMethods: ['merge' as const] },
      '#76: Squash and merge is turned off for this repository',
    ],
  ])('stops for %s and merges nothing', async (stop, overrides, reason) => {
    reads[76] = [viewOf({ number: 76, overrides })];

    expect(await train()).toEqual({
      kind: 'stopped',
      merged: 0,
      index: 0,
      stop,
      reason,
      isWithLead: false,
    });
    expect(order.some((line) => line.startsWith('merge'))).toBe(false);
  });

  it('stops when the host refuses a merge and leaves the rest alone', async () => {
    store.setState({
      mergePr: async () => {
        throw new Error('405 Method Not Allowed');
      },
    });

    const result = await train();

    expect(result).toMatchObject({ kind: 'stopped', merged: 0, index: 0, stop: 'refused' });
    expect(order).toEqual(['read 76']);
  });

  it('stops when the next branch cannot be updated', async () => {
    store.setState({ rebaseBranch: async () => 'busy' });

    expect(await train({ entries: ENTRIES.slice(0, 2) })).toMatchObject({
      kind: 'stopped',
      merged: 1,
      stop: 'update',
      reason: '#305 could not be updated: another rebase runs on this branch',
    });
  });

  it('stops when Goodboy cannot reach the host', async () => {
    expect(await train({ portFor: () => null })).toMatchObject({
      kind: 'stopped',
      merged: 0,
      stop: 'unreachable',
    });
  });
});
