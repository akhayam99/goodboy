// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import { brandId, type MountId, type SessionProjectMount } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useOriginCommitDiff } from './index';

const WORKSPACE = aWorkspace();
const LEDGER = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const PAYMENTS = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const PAYMENTS_MOUNT = brandId<MountId>({ value: 'mount-payments-api' });

type MountParams = {
  readonly mountId: MountId;
  readonly projectId: typeof LEDGER.id;
  readonly name: string;
  readonly parallelIndex: number;
};

const mountOf = ({
  mountId,
  projectId,
  name,
  parallelIndex,
}: MountParams): SessionProjectMount => ({
  mountId,
  sessionId: SESSION.id,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: `/worktrees/${name}`,
  repoRoot: `/repos/${name}`,
  branch: 'hl/fix-credit',
  baseBranch: 'main',
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const DIFF = [
  'diff --git a/src/fees.ts b/src/fees.ts',
  '--- a/src/fees.ts',
  '+++ b/src/fees.ts',
  '@@ -1 +1 @@',
  '-const fee = 1;',
  '+const fee = 2;',
  '',
].join('\n');

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    workspaces: [WORKSPACE],
    projects: [LEDGER, PAYMENTS],
    sessions: [SESSION],
    sessionActiveMount: { [SESSION.id]: LEDGER_MOUNT },
    sessionActiveProject: { [SESSION.id]: LEDGER.id },
    sessionProjectMounts: {
      [SESSION.id]: [
        mountOf({
          mountId: LEDGER_MOUNT,
          projectId: LEDGER.id,
          name: 'ledger-core',
          parallelIndex: 0,
        }),
        mountOf({
          mountId: PAYMENTS_MOUNT,
          projectId: PAYMENTS.id,
          name: 'payments-api',
          parallelIndex: 0,
        }),
      ],
    },
  });
});

afterEach(cleanup);

const commitReads = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'worktree_diff_commit');

describe('the mini diff of a commit that is new on origin', () => {
  it('reads the worktree it was given, not the one that takes the writes', async () => {
    stubStoryInvoke({ worktree_diff_commit: async () => DIFF });

    const { result } = renderHook(() =>
      useOriginCommitDiff({
        sessionId: SESSION.id,
        sha: 'abc123',
        path: 'src/fees.ts',
        worktreePath: '/worktrees/payments-api',
      }),
    );

    await waitFor(() => expect(result.current.files).toHaveLength(1));
    expect(commitReads()).toHaveLength(1);
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_diff_commit', {
      worktreePath: '/worktrees/payments-api',
      sha: 'abc123',
    });
  });

  it('falls back to the mount that takes the writes only when it was given no worktree', async () => {
    stubStoryInvoke({ worktree_diff_commit: async () => DIFF });

    const { result } = renderHook(() =>
      useOriginCommitDiff({
        sessionId: SESSION.id,
        sha: 'abc123',
        path: 'src/fees.ts',
        worktreePath: null,
      }),
    );

    await waitFor(() => expect(result.current.files).toHaveLength(1));
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_diff_commit', {
      worktreePath: '/worktrees/ledger-core',
      sha: 'abc123',
    });
  });

  it('says it could not read the commit instead of showing an empty diff', async () => {
    stubStoryInvoke({
      worktree_diff_commit: async () => {
        throw new Error('fatal: bad object abc123');
      },
    });

    const { result } = renderHook(() =>
      useOriginCommitDiff({
        sessionId: SESSION.id,
        sha: 'abc123',
        path: 'src/fees.ts',
        worktreePath: '/worktrees/payments-api',
      }),
    );

    await waitFor(() => expect(result.current.hasFailed).toBe(true));
    expect(result.current.files).toEqual([]);
  });

  it('reads nothing and reports no failure while the commit is not known yet', () => {
    stubStoryInvoke({ worktree_diff_commit: async () => DIFF });

    const { result } = renderHook(() =>
      useOriginCommitDiff({
        sessionId: SESSION.id,
        sha: null,
        path: null,
        worktreePath: '/worktrees/payments-api',
      }),
    );

    expect(commitReads()).toHaveLength(0);
    expect(result.current).toEqual({ files: [], hasFailed: false });
  });
});
