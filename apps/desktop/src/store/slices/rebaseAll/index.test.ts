// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, SessionProjectMount } from '@goodboy/types';
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
});
