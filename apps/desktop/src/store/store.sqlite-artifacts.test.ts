import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertArtifact } from '@goodboy/db';
import type { AgentId, ArtifactId, ArtifactKind, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-payments' as SessionId;
const AGENT_ID = 'agent-planner' as AgentId;
const PLAN_ID = 'artifact-plan' as ArtifactId;
const REPORT_ID = 'artifact-report' as ArtifactId;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});
const session = buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });

let useAppStore: StoryStore;

const insert = async ({ id, kind }: { readonly id: ArtifactId; readonly kind: ArtifactKind }) => {
  const db = storySqlite();
  await insertArtifact({
    db,
    input: {
      id,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      kind,
      schemaVersion: 1,
      title: kind === 'plan' ? 'Speed up the payout export' : 'Q3 reconciliation drift',
      sourceFormat: 'markdown',
      sourceText: '## Goal',
      metadata: kind === 'plan' ? {} : { reportType: 'session-summary' },
    },
  });
};

const statusOf = async (id: ArtifactId) =>
  (
    await rowsOf<{ status: string }>({
      sql: `SELECT status FROM session_artifacts WHERE id = '${id}'`,
    })
  )[0]?.status ?? null;

const consume = async () => {
  await storySqlite().execute(
    `INSERT INTO plan_consumptions (id, plan_id, artifact_kind, agent_id, consumed_at)
     VALUES ('consumption-1', ?, 'plan', ?, 1)`,
    [PLAN_ID, AGENT_ID],
  );
  await storySqlite().execute("UPDATE session_artifacts SET status = 'consumed' WHERE id = ?", [
    PLAN_ID,
  ]);
};

const load = async () => {
  await useAppStore.getState().loadSessionArtifacts(SESSION_ID);
  await useAppStore.getState().loadSessionPlans(SESSION_ID);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ artifact_mirror_remove: true });
  const db = await openStorySqlite();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, 'Harborline', 'harborline', 1, 1)",
    [WORKSPACE_ID],
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, 'Goal', 'idle', 1, 1)",
    [SESSION_ID, WORKSPACE_ID],
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 0, 'Planner', 'completed')",
    [AGENT_ID, SESSION_ID],
  );
  await insert({ id: PLAN_ID, kind: 'plan' });
  await insert({ id: REPORT_ID, kind: 'report' });
  useAppStore.setState({ workspaces: [harborline], sessions: [session] });
  await load();
});

const removedFolders = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'artifact_mirror_remove');

describe('store on sqlite: deleting artifacts', () => {
  it('deletes a report and a plan alike and Undo puts each back with the status it had', async () => {
    await consume();
    await load();

    const previousPlan = await useAppStore
      .getState()
      .deleteArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID });
    const previousReport = await useAppStore
      .getState()
      .deleteArtifact({ sessionId: SESSION_ID, artifactId: REPORT_ID });

    expect([previousPlan, previousReport]).toEqual(['consumed', 'active']);
    expect([await statusOf(PLAN_ID), await statusOf(REPORT_ID)]).toEqual([
      'discarded',
      'discarded',
    ]);
    expect(
      useAppStore.getState().sessionPlans[SESSION_ID]?.find((plan) => plan.id === PLAN_ID)?.status,
    ).toBe('discarded');

    await useAppStore
      .getState()
      .restoreArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID, status: 'consumed' });
    await useAppStore
      .getState()
      .restoreArtifact({ sessionId: SESSION_ID, artifactId: REPORT_ID, status: 'active' });

    expect([await statusOf(PLAN_ID), await statusOf(REPORT_ID)]).toEqual(['consumed', 'active']);
    expect(
      useAppStore.getState().sessionArtifacts[SESSION_ID]?.map((artifact) => artifact.status),
    ).toEqual(['consumed', 'active']);
  });

  it('restores a plan that ran to Ran even without the status it had', async () => {
    await consume();
    await load();
    await useAppStore.getState().deleteArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID });
    await useAppStore.getState().restoreArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID });
    expect(await statusOf(PLAN_ID)).toBe('consumed');
  });

  it('does not delete twice', async () => {
    await useAppStore.getState().deleteArtifact({ sessionId: SESSION_ID, artifactId: REPORT_ID });
    const second = await useAppStore
      .getState()
      .deleteArtifact({ sessionId: SESSION_ID, artifactId: REPORT_ID });
    expect(second).toBeNull();
  });

  it('keeps a live artifact when asked to delete it permanently', async () => {
    await useAppStore
      .getState()
      .deleteArtifactPermanently({ sessionId: SESSION_ID, artifactId: REPORT_ID });
    expect(await statusOf(REPORT_ID)).toBe('active');
    expect(removedFolders()).toEqual([]);
  });

  it('deleting a plan for good drops its row, its run history and its saved copy', async () => {
    await consume();
    await load();
    await useAppStore.getState().deleteArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID });

    await useAppStore
      .getState()
      .deleteArtifactPermanently({ sessionId: SESSION_ID, artifactId: PLAN_ID });

    expect(await statusOf(PLAN_ID)).toBeNull();
    expect(
      await rowsOf({ sql: `SELECT id FROM plan_consumptions WHERE plan_id = '${PLAN_ID}'` }),
    ).toEqual([]);
    expect(useAppStore.getState().sessionPlans[SESSION_ID]).toEqual([]);
    expect(
      useAppStore.getState().sessionArtifacts[SESSION_ID]?.map((artifact) => artifact.id),
    ).toEqual([REPORT_ID]);
    expect(removedFolders()).toHaveLength(1);
    expect(removedFolders()[0]?.[1]).toMatchObject({ workspaceSlug: 'harborline' });
  });

  it('marks a report as opened once and keeps the first time', async () => {
    const [before] = useAppStore.getState().sessionArtifacts[SESSION_ID] ?? [];
    expect(before?.openedAt).toBeNull();
    useAppStore.getState().markArtifactOpened({ sessionId: SESSION_ID, artifactId: REPORT_ID });
    const opened = useAppStore
      .getState()
      .sessionArtifacts[SESSION_ID]?.find((artifact) => artifact.id === REPORT_ID);
    const firstTime = opened?.openedAt ?? null;
    useAppStore.getState().markArtifactOpened({ sessionId: SESSION_ID, artifactId: REPORT_ID });
    expect(firstTime).not.toBeNull();
    expect(
      useAppStore
        .getState()
        .sessionArtifacts[SESSION_ID]?.find((artifact) => artifact.id === REPORT_ID)?.openedAt,
    ).toBe(firstTime);
  });
});
