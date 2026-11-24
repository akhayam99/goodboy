// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertSession,
  insertSessionMount,
  insertWorkspace,
  upsertMountPullRequestLink,
} from '@goodboy/db';
import {
  brandId,
  type MountId,
  type MountPullRequestLink,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, TEST_NOW } from '@goodboy/types/testing';
import { useImpactMetrics } from './index';
import {
  buildStoryWorkspace,
  injectDbFault,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../../features/chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../../features/permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../features/providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../features/providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../features/budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../features/worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 } });
  await openStorySqlite();
});

afterEach(() => {
  cleanup();
});

describe('impact refresh of open pull requests of deleted sessions', () => {
  it('waits for GitHub and refreshes once it becomes available', async () => {
    const refresh = vi.fn(async () => 0);
    useAppStore.setState({ githubStatus: null, refreshDormantPullRequests: refresh });

    renderHook(() => useImpactMetrics({ workspaceId: WORKSPACE_ID, windowId: 'all' }));
    await act(async () => undefined);
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      useAppStore.setState({ githubStatus: { mode: 'pat', available: true } });
    });

    expect(refresh).toHaveBeenCalledExactlyOnceWith(WORKSPACE_ID);
  });
});

describe('Impact asks about live work when it opens', () => {
  it('shows a merge that the open sweep observes after the first read', async () => {
    const db = storySqlite();
    const sessionId = brandId<SessionId>({ value: 'session-northwind-payout' });
    const mountId = brandId<MountId>({ value: 'mount-payout' });
    await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: WORKSPACE_ID }) });
    await insertSession(db, aSession({ id: sessionId, workspaceId: WORKSPACE_ID }));
    await insertSessionMount({
      db,
      mount: {
        id: mountId,
        sessionId,
        projectId: null,
        worktreePath: '/tmp/payments-api/payout',
        lastWorktreePath: null,
        branch: 'northwind/payout',
        baseBranch: 'main',
        parallelIndex: 0,
        mountName: 'payments-api',
        repoSlug: 'acme/payments-api',
        isAttached: true,
        diskState: 'present',
        revision: 1,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
      },
    });
    const link: MountPullRequestLink = {
      id: 'link-payout',
      mountId,
      provider: 'github',
      host: 'github.com',
      repoSlug: 'acme/payments-api',
      prNumber: 31,
      headBranch: 'northwind/payout',
      baseBranch: 'main',
      url: 'https://github.com/acme/payments-api/pull/31',
      state: 'open',
      snapshot: null,
      mergedHeadSha: null,
      mergedAt: null,
      lastObservedAt: TEST_NOW,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    };
    await upsertMountPullRequestLink({ db, sessionId, link });
    const sweep = vi.fn(async () => {
      await upsertMountPullRequestLink({
        db,
        sessionId,
        link: { ...link, state: 'merged', mergedAt: TEST_NOW, lastObservedAt: TEST_NOW },
      });
    });
    useAppStore.setState({ sweepRequests: sweep });

    const { result } = renderHook(() =>
      useImpactMetrics({ workspaceId: WORKSPACE_ID, windowId: 'all' }),
    );

    await waitFor(() => expect(result.current.pullRequests.data?.merged).toBe(1));
    expect(sweep).toHaveBeenCalledOnce();
    expect(result.current.pullRequests.data?.open).toBe(0);
  });
});

describe('Impact keeps the last completed read', () => {
  it('keeps its overview while refreshing and after a failed refresh', async () => {
    const { result } = renderHook(() =>
      useImpactMetrics({ workspaceId: WORKSPACE_ID, windowId: 'all' }),
    );
    await waitFor(() => expect(result.current.loading.overview).toBe(false));
    const overview = result.current.overview.data;
    expect(overview).not.toBeNull();
    injectDbFault({ match: /orchestrated_sessions/, message: 'database is locked' });
    act(() => result.current.retry('overview'));
    expect(result.current.overview.data).toBe(overview);
    await waitFor(() =>
      expect(result.current.overview.error?.message).toContain('database is locked'),
    );
    expect(result.current.overview.data).toBe(overview);
  });
});
