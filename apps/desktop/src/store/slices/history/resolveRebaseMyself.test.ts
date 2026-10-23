// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  HistoryRebasePlan,
  IsoDateTime,
  MountId,
  SessionEvent,
  SessionEventId,
  SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession, nextProjectId, nextSessionId } from '@goodboy/types/testing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { aRebaseRun } from '../../../features/history/testing/aRebaseRun';
import { brandedId } from '../../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const MOUNT_ID = brandedId<MountId>({ value: 'mount-members' });
const WORKTREE = '/w/harbor-portal-members';

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'harbor-portal',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repos/harbor-portal',
  branch: 'hl/feat-center-members-page',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const STOP = {
  reason: 'conflict',
  message: '1 file conflicts with main.',
  files: ['src/pages/members/MembersPage.tsx'],
  sha: null,
  head: 'b0a1c2d',
} as const;

const CONFLICT_RUN = aRebaseRun({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  phase: 'stopped',
  stop: STOP,
  rebaseConflict: {
    ontoRef: 'origin/main',
    baseBranch: 'main',
    head: 'b0a1c2d',
    autoAgentId: null,
  },
});

const SAVED: SessionEvent = {
  id: brandedId<SessionEventId>({ value: 'ev-stop' }),
  sessionId: SESSION_ID,
  kind: 'history_stopped',
  payload: { mountId: MOUNT_ID, branch: MOUNT.branch, origin: 'rebase', ...STOP },
  createdAt: brandedId<IsoDateTime>({ value: '2026-10-01T10:00:00.000Z' }),
};

const PLAN: HistoryRebasePlan = {
  onto: 'c0ffee000000',
  ontoRef: 'origin/main',
  mergeBase: 'a0a0a0a0a0a0',
  head: 'b0a1c2d',
  commits: [],
  behind: 6,
  fetchError: null,
};

let store: StoryStore;

const started: Array<unknown> = [];

const startRebase = (args: unknown) => {
  started.push(args);
  return { isInProgress: true };
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  started.length = 0;
  stubStoryInvoke({ history_rebase_plan: () => PLAN, worktree_start_rebase: startRebase });
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'harbor-portal' })],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
  });
});

const terminals = (): number => (store.getState().terminalTabs[SESSION_ID] ?? []).length;

describe('resolve myself', () => {
  it('starts the rebase in the worktree on the stop base, marks it, and opens the terminal', async () => {
    store.setState({ historyRuns: { [MOUNT_ID]: CONFLICT_RUN } });

    await expect(
      store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ isInProgress: true });

    expect(started).toEqual([
      { worktreePath: WORKTREE, onto: 'origin/main', branch: MOUNT.branch },
    ]);
    expect(store.getState().historyRuns[MOUNT_ID]?.rebaseConflict?.isHere).toBe(true);
    expect(terminals()).toBe(1);
  });

  it('reads the base again for a stop saved before a restart', async () => {
    store.setState({ sessionEvents: { [SESSION_ID]: [SAVED] } });

    await store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(started).toEqual([
      { worktreePath: WORKTREE, onto: 'origin/main', branch: MOUNT.branch },
    ]);
    expect(store.getState().historyRuns[MOUNT_ID]?.rebaseConflict).toMatchObject({
      ontoRef: 'origin/main',
      isHere: true,
    });
  });

  it('starts no rebase when the mount is detached while the base is read', async () => {
    store.setState({ sessionEvents: { [SESSION_ID]: [SAVED] } });
    stubStoryInvoke({
      history_rebase_plan: () => {
        store.setState({ sessionProjectMounts: { [SESSION_ID]: [] } });
        return PLAN;
      },
      worktree_start_rebase: startRebase,
    });

    await expect(
      store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow('Nothing was changed.');

    expect(started).toEqual([]);
    expect(store.getState().historyRuns[MOUNT_ID]).toBeUndefined();
    expect(terminals()).toBe(0);
  });

  it('starts no rebase when the mount points at another branch after the base is read', async () => {
    store.setState({ sessionEvents: { [SESSION_ID]: [SAVED] } });
    stubStoryInvoke({
      history_rebase_plan: () => {
        store.setState({
          sessionProjectMounts: { [SESSION_ID]: [{ ...MOUNT, branch: 'hl/fix-ledger-rounding' }] },
        });
        return PLAN;
      },
      worktree_start_rebase: startRebase,
    });

    await expect(
      store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow('now points at hl/fix-ledger-rounding');

    expect(started).toEqual([]);
    expect(terminals()).toBe(0);
  });

  it('starts no rebase when Auto takes the stop while the base is read', async () => {
    const conflict = { ontoRef: null, baseBranch: 'main', head: 'b0a1c2d', autoAgentId: null };
    const run = { ...CONFLICT_RUN, rebaseConflict: conflict };
    store.setState({ historyRuns: { [MOUNT_ID]: run } });
    stubStoryInvoke({
      history_rebase_plan: () => {
        store.setState({
          historyRuns: {
            [MOUNT_ID]: {
              ...run,
              rebaseConflict: {
                ...conflict,
                autoAgentId: brandedId<AgentId>({ value: 'agent-auto' }),
              },
            },
          },
        });
        return PLAN;
      },
      worktree_start_rebase: startRebase,
    });

    await expect(
      store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow('This rebase stop changed');

    expect(started).toEqual([]);
    expect(store.getState().historyRuns[MOUNT_ID]?.rebaseConflict?.isHere).toBeUndefined();
  });

  it('changes nothing and opens no terminal when git refuses to start', async () => {
    stubStoryInvoke({
      worktree_start_rebase: () => {
        throw new Error('cannot rebase: You have unstaged changes.');
      },
    });
    store.setState({ historyRuns: { [MOUNT_ID]: CONFLICT_RUN } });

    await expect(
      store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow('unstaged changes');

    expect(store.getState().historyRuns[MOUNT_ID]).toBe(CONFLICT_RUN);
    expect(terminals()).toBe(0);
  });

  it('does nothing for a stop that Auto already has', async () => {
    store.setState({
      historyRuns: {
        [MOUNT_ID]: {
          ...CONFLICT_RUN,
          rebaseConflict: {
            ontoRef: 'origin/main',
            baseBranch: 'main',
            head: 'b0a1c2d',
            autoAgentId: brandedId<AgentId>({ value: 'agent-auto' }),
          },
        },
      },
    });

    await expect(
      store.getState().resolveRebaseMyself({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toBeNull();
    expect(started).toEqual([]);
  });
});
