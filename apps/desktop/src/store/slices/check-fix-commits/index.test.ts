// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, BranchCommit, IsoDateTime, MountId } from '@goodboy/types';
import { aProject, aSession, anAgent } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

const SESSION = aSession();
const PROJECT = aProject({ workspaceId: SESSION.workspaceId, name: 'payments-api' });
const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-check-fix'));
const WORKTREE_PATH = '/w/payments-api';
const STARTED_AT: IsoDateTime = JSON.parse(JSON.stringify(new Date().toISOString()));
const FIX: Agent = anAgent({
  id: JSON.parse(JSON.stringify('agent-ci-fixer')),
  sessionId: SESSION.id,
  ordinal: 2,
  kind: 'implementer',
  status: 'completed',
  sourceKind: 'failed_check',
  startedAt: STARTED_AT,
});

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type CommitParams = {
  readonly shortSha: string;
  readonly isPushed: boolean;
};

const commitAfterStart = ({ shortSha, isPushed }: CommitParams): BranchCommit => ({
  sha: `${shortSha}0000000000000000000000000000000`,
  shortSha,
  subject: 'Guard the retry against double credits',
  author: 'Acme Dev',
  timestamp: Math.floor(Date.now() / 1_000) + 3_600,
  pushed: isPushed,
  parentSha: null,
});

const target = () => ({ sessionId: SESSION.id, mountId: MOUNT_ID, fixAgentId: FIX.id });

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    sessions: [SESSION],
    projects: [PROJECT],
    sessionProjectMounts: {
      [SESSION.id]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION.id,
          projectId: PROJECT.id,
          mountName: 'payments-api',
          worktreePath: WORKTREE_PATH,
          lastWorktreePath: null,
          repoRoot: '/repos/payments-api',
          branch: 'acme/fix-credits',
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
    sessionPhaseRuns: { [SESSION.id]: [FIX] },
  });
});

describe('readCheckFixCommit', () => {
  it('stores the commit made after the fix started and that it is not pushed', async () => {
    storySpies.listBranchCommits.mockResolvedValue([
      commitAfterStart({ shortSha: '9e4c1a7', isPushed: false }),
    ]);
    await store.getState().readCheckFixCommit(target());
    expect(storySpies.listBranchCommits).toHaveBeenCalledWith(WORKTREE_PATH);
    expect(store.getState().checkFixCommits[FIX.id]).toMatchObject({
      kind: 'found',
      sha: '9e4c1a7',
      unpushed: 1,
    });
  });
  it('stores none when the branch has no commit from the fix', async () => {
    storySpies.listBranchCommits.mockResolvedValue([]);
    await store.getState().readCheckFixCommit(target());
    expect(store.getState().checkFixCommits[FIX.id]).toEqual({ kind: 'none' });
  });
  it('stores unreadable when git fails, so the transcript can stand in', async () => {
    storySpies.listBranchCommits.mockRejectedValue(new Error('not a repository'));
    await store.getState().readCheckFixCommit(target());
    expect(store.getState().checkFixCommits[FIX.id]).toEqual({ kind: 'unreadable' });
  });
  it('drops a late answer that a newer read has already replaced', async () => {
    let releaseFirst: (commits: ReadonlyArray<BranchCommit>) => void = () => undefined;
    storySpies.listBranchCommits.mockImplementationOnce(
      () =>
        new Promise<ReadonlyArray<BranchCommit>>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    storySpies.listBranchCommits.mockResolvedValueOnce([
      commitAfterStart({ shortSha: 'bbbbbbb', isPushed: true }),
    ]);
    const first = store.getState().readCheckFixCommit(target());
    await store.getState().readCheckFixCommit(target());
    releaseFirst([commitAfterStart({ shortSha: 'aaaaaaa', isPushed: false })]);
    await first;
    expect(store.getState().checkFixCommits[FIX.id]).toMatchObject({
      sha: 'bbbbbbb',
      unpushed: 0,
    });
  });
  it('drops the answer when the fix is gone by the time git answers', async () => {
    let release: (commits: ReadonlyArray<BranchCommit>) => void = () => undefined;
    storySpies.listBranchCommits.mockImplementationOnce(
      () =>
        new Promise<ReadonlyArray<BranchCommit>>((resolve) => {
          release = resolve;
        }),
    );
    const pending = store.getState().readCheckFixCommit(target());
    store.setState({
      sessionPhaseRuns: {
        [SESSION.id]: (store.getState().sessionPhaseRuns[SESSION.id] ?? []).filter(
          (agent) => agent.id !== FIX.id,
        ),
      },
    });
    release([commitAfterStart({ shortSha: 'ccccccc', isPushed: false })]);
    await pending;
    expect(store.getState().checkFixCommits[FIX.id]).toBeUndefined();
  });
  it('reads a pushed commit after the push', async () => {
    storySpies.listBranchCommits.mockResolvedValueOnce([
      commitAfterStart({ shortSha: '9e4c1a7', isPushed: false }),
    ]);
    await store.getState().readCheckFixCommit(target());
    storySpies.listBranchCommits.mockResolvedValueOnce([
      commitAfterStart({ shortSha: '9e4c1a7', isPushed: true }),
    ]);
    await store.getState().readCheckFixCommit(target());
    expect(store.getState().checkFixCommits[FIX.id]).toMatchObject({
      sha: '9e4c1a7',
      unpushed: 0,
    });
  });
});
