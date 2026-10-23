// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  HistoryRebasePlan,
  MountId,
  SessionEvent,
  SessionEventKind,
  SessionProjectMount,
} from '@goodboy/types';
import {
  aProject,
  aSession,
  nextProjectId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import type { AppStore } from '../../store';
import type { HistoryRun } from '../history/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = nextSessionId();
const WORKSPACE_ID = nextWorkspaceId();
const LEDGER = nextProjectId();
const RELAY = nextProjectId();
const PAYMENTS = nextProjectId();
const AUTO_ID: AgentId = JSON.parse(JSON.stringify('agent-auto-rebase'));

type NameParams = {
  readonly name: string;
};

const mountIdOf = ({ name }: NameParams): MountId => JSON.parse(JSON.stringify(`mount-${name}`));

const LEDGER_MOUNT = mountIdOf({ name: 'ledger' });
const RELAY_MOUNT = mountIdOf({ name: 'relay' });
const PAYMENTS_MOUNT = mountIdOf({ name: 'payments' });

type MountSeed = {
  readonly mountId: MountId;
  readonly projectId: SessionProjectMount['projectId'];
  readonly name: string;
  readonly branch: string;
};

const mountOf = ({ mountId, projectId, name, branch }: MountSeed): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/w/${name}`,
  lastWorktreePath: null,
  repoRoot: `/repos/${name}`,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type ConflictRunParams = {
  readonly mountId: MountId;
  readonly files: ReadonlyArray<string>;
};

const conflictRun = ({ mountId, files }: ConflictRunParams): HistoryRun => ({
  sessionId: SESSION_ID,
  mountId,
  origin: 'rebase',
  phase: 'stopped',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: { reason: 'conflict', message: 'conflict', files, sha: 'a1' },
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: 3,
  rebaseConflict: {
    ontoRef: 'origin/main',
    baseBranch: 'main',
    head: 'f00dcafe1234',
    autoAgentId: null,
  },
  updatedAt: 1,
});

type Outcomes = Readonly<Record<string, 'rebased' | 'conflict' | 'stopped' | Error>>;

let store: StoryStore;

type SpawnCall = Parameters<AppStore['spawnAgent']>;

const spawned: Array<SpawnCall> = [];

type StubParams = {
  readonly outcomes: Outcomes;
  readonly onRebase?: (mountId: MountId) => void;
  readonly isAutoAccepting?: boolean;
  readonly spawnError?: Error;
};

const stub = ({ outcomes, onRebase, isAutoAccepting = true, spawnError }: StubParams): void => {
  store.setState({
    rebaseBranch: vi.fn(async ({ mountId }) => {
      onRebase?.(mountId);
      const outcome = outcomes[mountId];
      if (outcome instanceof Error) {
        throw outcome;
      }
      if (outcome === 'conflict') {
        store.setState((state) => ({
          historyRuns: {
            ...state.historyRuns,
            [mountId]: conflictRun({ mountId, files: ['src/ledger.ts', 'src/postings.ts'] }),
          },
        }));
      }
      return outcome ?? 'rebased';
    }),
    spawnAgent: vi.fn(async (...call: SpawnCall) => {
      spawned.push(call);
      if (spawnError !== undefined) {
        throw spawnError;
      }
      if (isAutoAccepting) {
        call[1].onKickoffAccepted?.();
      }
      return AUTO_ID;
    }),
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  spawned.length = 0;
  await resetStoryStore();
  store.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [
      aProject({ id: LEDGER, workspaceId: WORKSPACE_ID, name: 'ledger-core' }),
      aProject({ id: RELAY, workspaceId: WORKSPACE_ID, name: 'notify-relay' }),
      aProject({ id: PAYMENTS, workspaceId: WORKSPACE_ID, name: 'payments-api' }),
    ],
    sessionProjectMounts: {
      [SESSION_ID]: [
        mountOf({ mountId: LEDGER_MOUNT, projectId: LEDGER, name: 'ledger', branch: 'hl/ledger' }),
        mountOf({ mountId: RELAY_MOUNT, projectId: RELAY, name: 'relay', branch: 'hl/relay' }),
        mountOf({
          mountId: PAYMENTS_MOUNT,
          projectId: PAYMENTS,
          name: 'payments',
          branch: 'hl/payments',
        }),
      ],
    },
  });
});

const ALL = [LEDGER_MOUNT, RELAY_MOUNT, PAYMENTS_MOUNT];

const statesOf = (): ReadonlyArray<string> =>
  (store.getState().rebaseAllRuns[SESSION_ID]?.branches ?? []).map((branch) => branch.state);

describe('rebase all', () => {
  it('rebases the clean ones with git and hands every conflicted one to one Auto', async () => {
    stub({ outcomes: { [RELAY_MOUNT]: 'conflict', [PAYMENTS_MOUNT]: 'conflict' } });

    await expect(
      store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false }),
    ).resolves.toBe('handed');

    expect(spawned).toHaveLength(1);
    const [sessionId, args] = spawned[0] ?? [];
    expect(sessionId).toBe(SESSION_ID);
    expect(args?.kindOverride).toBe('auto');
    expect(args?.initialPrompt).toContain('notify-relay, branch hl/relay, worktree /w/relay');
    expect(args?.initialPrompt).toContain('payments-api, branch hl/payments');
    expect(args?.initialPrompt).not.toContain('hl/ledger');
    expect(args?.initialPrompt).toContain('ask the person a question');
    expect(args?.initialPrompt).toContain('Never push');
    expect(statesOf()).toEqual(['rebased', 'auto', 'auto']);
    expect(store.getState().rebaseAllRuns[SESSION_ID]).toMatchObject({
      phase: 'handed',
      autoAgentId: AUTO_ID,
    });
    expect(store.getState().historyRuns[RELAY_MOUNT]?.rebaseConflict?.autoAgentId).toBe(AUTO_ID);
  });

  it('starts no Auto when every branch rebases clean', async () => {
    stub({ outcomes: {} });

    await expect(
      store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false }),
    ).resolves.toBe('done');

    expect(spawned).toHaveLength(0);
    expect(statesOf()).toEqual(['rebased', 'rebased', 'rebased']);
  });

  it('gives every branch of one run the id of that run as its batch', async () => {
    stub({ outcomes: {} });

    await store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });

    const runId = store.getState().rebaseAllRuns[SESSION_ID]?.id;
    const calls = vi.mocked(store.getState().rebaseBranch).mock.calls;
    expect(calls.map(([input]) => input.mountId)).toEqual(ALL);
    expect(runId).toBeDefined();
    expect(calls.every(([input]) => input.batchId === runId)).toBe(true);
  });

  it('stops the remaining branches on abort and keeps the finished ones done', async () => {
    stub({
      outcomes: { [RELAY_MOUNT]: 'conflict' },
      onRebase: (mountId) => {
        if (mountId !== LEDGER_MOUNT) {
          return;
        }
        const run = store.getState().rebaseAllRuns[SESSION_ID];
        if (run !== undefined) {
          store.getState().abortRebaseAll({ sessionId: SESSION_ID, runId: run.id });
        }
      },
    });

    await expect(
      store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false }),
    ).resolves.toBe('aborted');

    expect(statesOf()).toEqual(['rebased', 'skipped', 'skipped']);
    expect(store.getState().rebaseAllRuns[SESSION_ID]?.phase).toBe('aborted');
    expect(spawned).toHaveLength(0);
  });

  it('goes on after a branch that failed and never undoes the others', async () => {
    stub({ outcomes: { [LEDGER_MOUNT]: new Error('origin cannot be reached') } });

    await store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });

    expect(statesOf()).toEqual(['failed', 'rebased', 'rebased']);
    expect(store.getState().rebaseAllRuns[SESSION_ID]?.branches[0]?.message).toBe(
      'origin cannot be reached',
    );
  });

  it('refuses a second run while one is running', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stub({ outcomes: {} });
    store.setState({
      rebaseBranch: vi.fn(async () => {
        await gate;
        return 'rebased' as const;
      }),
    });

    const first = store
      .getState()
      .rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });
    await expect(
      store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false }),
    ).resolves.toBe('busy');
    release();
    await expect(first).resolves.toBe('done');
  });

  it('keeps the conflicts asking when Auto cannot start, so each can be retried', async () => {
    stub({ outcomes: { [RELAY_MOUNT]: 'conflict' }, spawnError: new Error('no provider') });

    await expect(
      store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false }),
    ).resolves.toBe('done');

    expect(store.getState().rebaseAllRuns[SESSION_ID]?.error).toBe('no provider');
    expect(statesOf()).toEqual(['rebased', 'conflict', 'rebased']);
    expect(store.getState().historyRuns[RELAY_MOUNT]?.rebaseConflict?.autoAgentId).toBeNull();

    stub({ outcomes: {} });
    await store.getState().resolveRebaseWithAuto({
      sessionId: SESSION_ID,
      mountIds: [RELAY_MOUNT],
      hint: 'Keep the retry key from main.',
    });
    expect(store.getState().historyRuns[RELAY_MOUNT]?.rebaseConflict?.autoAgentId).toBe(AUTO_ID);
    expect(spawned.at(-1)?.[1].initialPrompt).toContain(
      'A hint from the person: Keep the retry key from main.',
    );
  });

  it('hands every rebased branch to the same Auto run when tidy is on', async () => {
    stub({ outcomes: { [RELAY_MOUNT]: 'conflict' } });

    await store.getState().rebaseAll({
      sessionId: SESSION_ID,
      mountIds: [LEDGER_MOUNT, RELAY_MOUNT],
      shouldTidy: true,
    });

    expect(spawned).toHaveLength(1);
    const prompt = spawned[0]?.[1].initialPrompt ?? '';
    expect(prompt).toContain('After each rebase, also tidy the commits of these branches:');
    expect(prompt).toContain('1. ledger-core, branch hl/ledger, worktree /w/ledger.');
    expect(prompt).toContain('2. notify-relay, branch hl/relay, worktree /w/relay.');
    expect(prompt).toContain('Never push and never force push');
  });

  it('starts no Auto at all when tidy is off and nothing conflicts, and keeps tidy off by default', async () => {
    stub({ outcomes: {} });
    await store
      .getState()
      .rebaseAll({ sessionId: SESSION_ID, mountIds: [LEDGER_MOUNT], shouldTidy: false });
    expect(spawned).toHaveLength(0);
  });

  it('drops a late Auto answer for a conflict the person already aborted', async () => {
    store.setState({
      historyRuns: { [RELAY_MOUNT]: conflictRun({ mountId: RELAY_MOUNT, files: ['a.ts'] }) },
    });
    const accepted: Array<() => void> = [];
    store.setState({
      spawnAgent: vi.fn(async (...call: SpawnCall) => {
        const onAccepted = call[1].onKickoffAccepted;
        if (onAccepted !== undefined) {
          accepted.push(onAccepted);
        }
        return AUTO_ID;
      }),
    });

    await store
      .getState()
      .resolveRebaseWithAuto({ sessionId: SESSION_ID, mountIds: [RELAY_MOUNT], hint: '' });
    store.getState().dismissHistoryRun({ sessionId: SESSION_ID, mountId: RELAY_MOUNT });
    accepted.forEach((accept) => accept());

    expect(store.getState().historyRuns[RELAY_MOUNT]).toBeUndefined();
  });

  it('refuses to dismiss while Auto is being handed the work, and still takes its late acceptance', async () => {
    stub({ outcomes: { [RELAY_MOUNT]: 'conflict' } });
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.setState({
      spawnAgent: vi.fn(async (...call: SpawnCall) => {
        spawned.push(call);
        await gate;
        call[1].onKickoffAccepted?.();
        return AUTO_ID;
      }),
    });

    const first = store
      .getState()
      .rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });
    await vi.waitFor(() => expect(spawned).toHaveLength(1));
    const run = store.getState().rebaseAllRuns[SESSION_ID];
    expect(run?.phase).toBe('handing');

    store.getState().dismissRebaseAll({ sessionId: SESSION_ID, runId: run?.id ?? '' });
    expect(store.getState().rebaseAllRuns[SESSION_ID]?.id).toBe(run?.id);
    await expect(
      store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false }),
    ).resolves.toBe('busy');

    release();
    await expect(first).resolves.toBe('handed');
    expect(store.getState().rebaseAllRuns[SESSION_ID]?.phase).toBe('handed');
    expect(store.getState().rebaseAllRuns[SESSION_ID]?.autoAgentId).toBe(AUTO_ID);
    expect(spawned).toHaveLength(1);
  });

  it('drops the late result of a batch that is gone and never revives its rows', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stub({ outcomes: {} });
    store.setState({
      rebaseBranch: vi.fn(async () => {
        await gate;
        return 'rebased' as const;
      }),
    });

    const first = store
      .getState()
      .rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });
    await vi.waitFor(() => expect(statesOf()).toEqual(['rebasing', 'queued', 'queued']));
    store.setState({ rebaseAllRuns: {} });
    release();

    await expect(first).resolves.toBe('aborted');
    expect(store.getState().rebaseAllRuns[SESSION_ID]).toBeUndefined();
  });

  it('lets the branch in flight finish on abort, and the late answer lands on that row only', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.setState({
      rebaseBranch: vi.fn(async () => {
        await gate;
        return 'rebased' as const;
      }),
    });

    const first = store
      .getState()
      .rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });
    await vi.waitFor(() => expect(statesOf()).toEqual(['rebasing', 'queued', 'queued']));
    const run = store.getState().rebaseAllRuns[SESSION_ID];
    store.getState().abortRebaseAll({ sessionId: SESSION_ID, runId: run?.id ?? '' });
    store.getState().abortRebaseAll({ sessionId: SESSION_ID, runId: 'another-run' });
    release();

    await expect(first).resolves.toBe('aborted');
    expect(statesOf()).toEqual(['rebased', 'skipped', 'skipped']);
  });

  it('retries only the branch that failed with a new batch once the old one is dismissed', async () => {
    stub({ outcomes: { [LEDGER_MOUNT]: new Error('origin cannot be reached') } });
    await store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });
    expect(statesOf()).toEqual(['failed', 'rebased', 'rebased']);
    const run = store.getState().rebaseAllRuns[SESSION_ID];
    store.getState().dismissRebaseAll({ sessionId: SESSION_ID, runId: run?.id ?? '' });

    stub({ outcomes: {} });
    await expect(
      store
        .getState()
        .rebaseAll({ sessionId: SESSION_ID, mountIds: [LEDGER_MOUNT], shouldTidy: false }),
    ).resolves.toBe('done');

    expect(statesOf()).toEqual(['rebased']);
  });

  it('keeps a finished run until it is dismissed, and never dismisses a running one', async () => {
    stub({ outcomes: {} });
    await store.getState().rebaseAll({ sessionId: SESSION_ID, mountIds: ALL, shouldTidy: false });
    const run = store.getState().rebaseAllRuns[SESSION_ID];
    expect(run?.phase).toBe('done');

    store.getState().dismissRebaseAll({ sessionId: SESSION_ID, runId: 'another-run' });
    expect(store.getState().rebaseAllRuns[SESSION_ID]).toBeDefined();
    store.getState().dismissRebaseAll({ sessionId: SESSION_ID, runId: run?.id ?? '' });
    expect(store.getState().rebaseAllRuns[SESSION_ID]).toBeUndefined();
  });

  describe('a stop saved before a restart, with no run in this window', () => {
    type SavedParams = {
      readonly id: string;
      readonly kind: SessionEventKind;
      readonly at: string;
    };

    const saved = ({ id, kind, at }: SavedParams): SessionEvent => ({
      id: JSON.parse(JSON.stringify(id)),
      sessionId: SESSION_ID,
      kind,
      payload: {
        mountId: RELAY_MOUNT,
        branch: 'hl/relay',
        origin: 'rebase',
        reason: 'conflict',
        files: ['src/relay.ts'],
        head: 'b0a1c2d3e4f5',
      },
      createdAt: JSON.parse(JSON.stringify(at)),
    });

    const STOP = saved({
      id: 'ev-stop',
      kind: 'history_stopped',
      at: '2026-10-22T10:00:00.000Z',
    });

    const PLAN: HistoryRebasePlan = {
      onto: 'c0ffee000000',
      ontoRef: 'origin/main',
      mergeBase: 'a0a0a0a0a0a0',
      head: 'b0a1c2d3e4f5',
      commits: [],
      behind: 6,
      fetchError: null,
    };

    it('reads the plan again and hands the branch to Auto', async () => {
      stub({ outcomes: {} });
      stubStoryInvoke({ history_rebase_plan: () => PLAN });
      store.setState({ sessionEvents: { [SESSION_ID]: [STOP] } });

      await expect(
        store
          .getState()
          .resolveRebaseWithAuto({ sessionId: SESSION_ID, mountIds: [RELAY_MOUNT], hint: '' }),
      ).resolves.toEqual({ kind: 'started', agentId: AUTO_ID });

      expect(spawned.at(-1)?.[1].initialPrompt).toContain(
        'notify-relay, branch hl/relay, worktree /w/relay: rebase on origin/main.',
      );
      expect(spawned.at(-1)?.[1].initialPrompt).toContain('src/relay.ts');
      expect(store.getState().historyRuns[RELAY_MOUNT]?.rebaseConflict).toEqual({
        ontoRef: 'origin/main',
        baseBranch: 'main',
        head: 'b0a1c2d3e4f5',
        autoAgentId: AUTO_ID,
      });
    });

    it('keeps the stop asking when the plan cannot be read, so it can be retried', async () => {
      stub({ outcomes: {} });
      stubStoryInvoke({
        history_rebase_plan: () => {
          throw new Error('fetch failed');
        },
      });
      store.setState({ sessionEvents: { [SESSION_ID]: [STOP] } });

      await expect(
        store
          .getState()
          .resolveRebaseWithAuto({ sessionId: SESSION_ID, mountIds: [RELAY_MOUNT], hint: '' }),
      ).rejects.toThrow('fetch failed');
      expect(spawned).toHaveLength(0);
      expect(store.getState().historyRuns[RELAY_MOUNT]).toBeUndefined();

      stubStoryInvoke({ history_rebase_plan: () => PLAN });
      await store
        .getState()
        .resolveRebaseWithAuto({ sessionId: SESSION_ID, mountIds: [RELAY_MOUNT], hint: '' });
      expect(store.getState().historyRuns[RELAY_MOUNT]?.rebaseConflict?.autoAgentId).toBe(AUTO_ID);
    });

    it('drops a late Auto acceptance once the stop was kept meanwhile', async () => {
      stubStoryInvoke({ history_rebase_plan: () => PLAN });
      store.setState({ sessionEvents: { [SESSION_ID]: [STOP] } });
      const accepted: Array<() => void> = [];
      store.setState({
        spawnAgent: vi.fn(async (...call: SpawnCall) => {
          const onAccepted = call[1].onKickoffAccepted;
          if (onAccepted !== undefined) {
            accepted.push(onAccepted);
          }
          return AUTO_ID;
        }),
      });

      await store
        .getState()
        .resolveRebaseWithAuto({ sessionId: SESSION_ID, mountIds: [RELAY_MOUNT], hint: '' });
      store.setState({
        sessionEvents: {
          [SESSION_ID]: [
            STOP,
            saved({ id: 'ev-kept', kind: 'history_restored', at: '2026-10-22T10:05:00.000Z' }),
          ],
        },
      });
      accepted.forEach((accept) => accept());

      expect(store.getState().historyRuns[RELAY_MOUNT]).toBeUndefined();
    });
  });

  describe('update all', () => {
    const UPDATE = {
      sessionId: SESSION_ID,
      rebaseMountIds: [LEDGER_MOUNT, RELAY_MOUNT],
      bringInMountIds: [PAYMENTS_MOUNT],
    };

    type BringInCall = Parameters<AppStore['bringOriginInAndPush']>[0];

    const broughtIn: Array<BringInCall> = [];

    type BringInParams = {
      readonly outcome: 'pushed' | Error;
    };

    const stubBringIn = ({ outcome }: BringInParams): void => {
      broughtIn.length = 0;
      store.setState({
        bringOriginInAndPush: vi.fn(async (input: BringInCall) => {
          broughtIn.push(input);
          if (outcome instanceof Error) {
            throw outcome;
          }
          return outcome;
        }),
      });
    };

    it('rebases the clean ones, brings origin in without the rewriter, and never starts Auto', async () => {
      stub({ outcomes: { [RELAY_MOUNT]: 'conflict' } });
      stubBringIn({ outcome: 'pushed' });

      await expect(store.getState().updateAll(UPDATE)).resolves.toBe('done');

      expect(spawned).toHaveLength(0);
      expect(statesOf()).toEqual(['rebased', 'conflict', 'rebased']);
      expect(broughtIn).toEqual([
        { sessionId: SESSION_ID, mountId: PAYMENTS_MOUNT, canStartRewriter: false },
      ]);
      expect(store.getState().rebaseAllRuns[SESSION_ID]?.phase).toBe('done');
    });

    it('keeps one failure on its own row with its error and finishes the others', async () => {
      stub({ outcomes: { [LEDGER_MOUNT]: new Error('git is busy') } });
      stubBringIn({ outcome: new Error('The working tree has 2 uncommitted files.') });

      await store.getState().updateAll(UPDATE);

      const branches = store.getState().rebaseAllRuns[SESSION_ID]?.branches ?? [];
      expect(branches.map((branch) => [branch.state, branch.message])).toEqual([
        ['failed', 'git is busy'],
        ['rebased', null],
        ['failed', 'The working tree has 2 uncommitted files.'],
      ]);
    });

    it('ignores a second click while it runs', async () => {
      let release = (): void => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      stub({ outcomes: {}, onRebase: () => undefined });
      store.setState({
        rebaseBranch: vi.fn(async () => {
          await gate;
          return 'rebased' as const;
        }),
      });
      stubBringIn({ outcome: 'pushed' });

      const first = store.getState().updateAll(UPDATE);
      await expect(store.getState().updateAll(UPDATE)).resolves.toBe('busy');
      release();

      await expect(first).resolves.toBe('done');
      expect(broughtIn).toHaveLength(1);
    });

    it('retries after a failure with a new run that updates the branch', async () => {
      stub({ outcomes: { [LEDGER_MOUNT]: new Error('git is busy') } });
      stubBringIn({ outcome: 'pushed' });
      await store.getState().updateAll(UPDATE);
      const failedRun = store.getState().rebaseAllRuns[SESSION_ID]?.id;

      stub({ outcomes: {} });
      await store.getState().updateAll(UPDATE);

      expect(store.getState().rebaseAllRuns[SESSION_ID]?.id).not.toBe(failedRun);
      expect(statesOf()).toEqual(['rebased', 'rebased', 'rebased']);
    });
  });
});
