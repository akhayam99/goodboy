import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertSession, insertWorkspace } from '@goodboy/db';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import type { ScopeState } from './scopeOfState';
import { loadOtherWorkspaceScope } from './loadOtherWorkspaceScope';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../../store/storyHarness')).repoModuleMock(),
);

const NORTHWIND_ID = 'workspace-northwind' as WorkspaceId;
const SESSION_ID = 'session-onboarding' as SessionId;
const FAILED_AT = Date.parse('2026-10-06T08:00:00.000Z');
const MERGED_AT = Date.parse('2026-10-06T09:00:00.000Z');

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly requestState: 'merged' | 'open';
  readonly hasOpenThread?: boolean;
};

const seed = async ({ requestState, hasOpenThread = false }: SeedParams) => {
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: NORTHWIND_ID, name: 'Northwind', slug: 'northwind' }),
  });
  await insertSession(
    db,
    buildStorySession({ id: SESSION_ID, workspaceId: NORTHWIND_ID, goal: 'Plan the onboarding' }),
  );
  await db.execute("UPDATE sessions SET state_kind = 'error' WHERE id = ?", [SESSION_ID]);
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, created_at, updated_at, kind)
     VALUES ('project-notify-relay', ?, 'notify-relay', '/tmp/notify-relay', 1, 1, 'repo')`,
    [NORTHWIND_ID],
  );
  await db.execute(
    `INSERT INTO session_worktrees (id, session_id, branch, project_id, mount_name, is_attached, disk_state, created_at)
     VALUES ('mount-onboarding', ?, 'northwind/onboarding', 'project-notify-relay', 'notify-relay', 0, 'removed', 1)`,
    [SESSION_ID],
  );
  await db.execute(
    `INSERT INTO mount_pr_links
       (id, mount_id, provider, host, repo_slug, pr_number, head_branch, url, state, snapshot_json, last_observed_at, created_at, updated_at, merged_at)
     VALUES ('link-onboarding', 'mount-onboarding', 'gitlab', 'gitlab.com', 'northwind/notify-relay', 12, 'northwind/onboarding', 'https://example.test/12', ?, '{}', 1, 1, 1, ?)`,
    [requestState, requestState === 'merged' ? MERGED_AT : null],
  );
  await insertAgent(db, {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'implement',
    status: 'failed',
    startedAt: new Date(FAILED_AT - 60_000).toISOString() as IsoDateTime,
    completedAt: new Date(FAILED_AT).toISOString() as IsoDateTime,
  });
  if (hasOpenThread) {
    await db.execute(
      `INSERT INTO resolve_threads (id, session_id, thread_id, origin_kind, state, created_at, updated_at)
       VALUES ('thread-1', ?, 'provider-thread-1', 'review_comment', 'needs_answer', 1, 1)`,
      [SESSION_ID],
    );
  }
};

const scopeOf = () =>
  loadOtherWorkspaceScope({
    db: storySqlite(),
    workspace: { id: NORTHWIND_ID, name: 'Northwind' },
    base: useAppStore.getState() as ScopeState,
  });

beforeEach(async () => {
  await resetStoryStore();
});

describe('the scope of another workspace reads mounts, removed branch history and threads', () => {
  it('drops a failure that predates a merged request of a removed branch', async () => {
    await seed({ requestState: 'merged' });

    const scope = await scopeOf();

    expect(scope.infos[SESSION_ID]).toMatchObject({ stage: 'done', attention: null });
  });

  it('keeps the failure while the request is still open', async () => {
    await seed({ requestState: 'open' });

    const scope = await scopeOf();

    expect(scope.infos[SESSION_ID]).toMatchObject({ attention: 'agent-error' });
  });

  it('keeps the failure while a review thread waits on a merged request', async () => {
    await seed({ requestState: 'merged', hasOpenThread: true });

    const scope = await scopeOf();

    expect(scope.infos[SESSION_ID]?.attention).not.toBeNull();
  });
});
