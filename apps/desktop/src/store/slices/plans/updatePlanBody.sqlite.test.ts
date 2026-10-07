import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertSession,
  insertWorkspace,
  listArtifactRevisions,
  updateArtifactSource,
  upsertPlan,
} from '@goodboy/db';
import type { AgentId, PlanId, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-retry-payments' as SessionId;
const AGENT_ID = 'agent-planner' as AgentId;
const PLAN_ID = 'plan-retry-with-backoff' as PlanId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }));
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 0, 'Planner', 'completed')",
    [AGENT_ID, SESSION_ID],
  );
  await upsertPlan(db, {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    title: 'Retry with backoff',
    bodyMd: '1. Add backoff',
  });
  useAppStore.setState({ sessionPlans: {}, sessionArtifacts: {} });
  await useAppStore.getState().loadSessionPlans(SESSION_ID);
  await useAppStore.getState().loadSessionArtifacts(SESSION_ID);
});

const revisions = () => listArtifactRevisions({ db: storySqlite(), artifactId: PLAN_ID });

describe('updatePlanBody on sqlite', () => {
  it('saves from the revision it started on, bumps it as the user and refreshes plans and artifacts', async () => {
    const result = await useAppStore
      .getState()
      .updatePlanBody(SESSION_ID, PLAN_ID, 'Retry twice', '1. Add backoff\n2. Test it', 1);

    expect(result).toEqual({ kind: 'saved', revision: 2 });
    expect(useAppStore.getState().sessionPlans[SESSION_ID]?.[0]).toMatchObject({
      title: 'Retry twice',
      bodyMd: '1. Add backoff\n2. Test it',
    });
    expect(useAppStore.getState().sessionArtifacts[SESSION_ID]?.[0]).toMatchObject({
      title: 'Retry twice',
      revision: 2,
    });
    expect((await revisions()).map((revision) => [revision.revision, revision.author])).toEqual([
      [2, 'user'],
      [1, 'agent'],
    ]);
  });

  it('answers conflict and writes nothing when the planner wrote v2 meanwhile', async () => {
    await updateArtifactSource({
      db: storySqlite(),
      input: {
        id: PLAN_ID,
        title: 'Retry with jitter',
        sourceFormat: 'markdown',
        sourceText: '1. Add jitter',
        metadata: {},
        note: { author: 'agent' },
      },
    });

    const result = await useAppStore
      .getState()
      .updatePlanBody(SESSION_ID, PLAN_ID, 'My edit', 'my text', 1);

    expect(result).toEqual({ kind: 'conflict', revision: 2 });
    expect((await revisions()).map((revision) => [revision.revision, revision.author])).toEqual([
      [2, 'agent'],
      [1, 'agent'],
    ]);
    expect(useAppStore.getState().sessionPlans[SESSION_ID]?.[0]?.title).toBe('Retry with backoff');
  });
});
