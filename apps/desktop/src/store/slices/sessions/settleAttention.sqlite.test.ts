import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertSession, insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type AgentStatus,
  type IsoDateTime,
  type SessionId,
  type StepId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
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

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandId<SessionId>({ value: 'session-webhooks' });
const FAILED_AT = 1_790_000_000_000;
const LAUNCH_MS = Date.parse('2026-11-20T08:00:00.000Z');
const STEP = brandId<StepId>({ value: 'step-implement' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly status: AgentStatus;
  readonly completedAt: number;
};

const seedAgent = async ({ id, ordinal, status, completedAt }: SeedParams) => {
  const iso = new Date(completedAt).toISOString() as IsoDateTime;
  await insertAgent(storySqlite(), {
    id: brandId<AgentId>({ value: id }),
    sessionId: SESSION_ID,
    ordinal,
    name: `agent ${id}`,
    status,
    completedAt: iso,
    stepId: STEP,
  });
  await storySqlite().execute('UPDATE agents SET last_finished_at = ? WHERE id = ?', [
    completedAt,
    id,
  ]);
};

const agentRowOf = ({ id, status, completedAt }: Omit<SeedParams, 'ordinal'>) =>
  anAgent({
    id: brandId<AgentId>({ value: id }),
    sessionId: SESSION_ID,
    stepId: STEP,
    status,
    completedAt: new Date(completedAt).toISOString() as IsoDateTime,
  });

const stateKindOf = async () =>
  (
    await rowsOf<{ state_kind: string }>({
      sql: 'SELECT state_kind FROM sessions WHERE id = ?',
      params: [SESSION_ID],
    })
  )[0]?.state_kind;

const unreadRows = async () =>
  rowsOf<{ id: string }>({ sql: 'SELECT id FROM notifications WHERE read = 0' });

const FAILED = { id: 'implement', status: 'failed', completedAt: FAILED_AT } as const;

const seedScene = async ({ isRetried }: { readonly isRetried: boolean }) => {
  const retried = {
    id: 'implement-retry',
    status: 'completed',
    completedAt: Date.now() + 60_000,
  } as const;
  await seedAgent({ ...FAILED, ordinal: 0 });
  if (isRetried) {
    await seedAgent({ ...retried, ordinal: 1 });
  }
  await storySqlite().execute("UPDATE sessions SET state_kind = 'error' WHERE id = ?", [
    SESSION_ID,
  ]);
  useAppStore.setState({
    sessions: [
      aSession({
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        state: {
          kind: 'error',
          message: 'Step failed',
          failedAt: '2026-11-20T09:00:00.000Z' as IsoDateTime,
        },
      }),
    ],
    sessionPhaseRuns: {
      [SESSION_ID]: [agentRowOf(FAILED), ...(isRetried ? [agentRowOf(retried)] : [])],
    },
  });
  await useAppStore.getState().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: "Couldn't resume Implement after the restart",
    sessionId: SESSION_ID,
    coalesceKey: 'resume-failed:implement-retry',
    action: {
      kind: 'continue-agent',
      sessionId: SESSION_ID,
      agentId: brandId<AgentId>({ value: 'implement-retry' }),
    },
  });
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ process_launch_stamp: LAUNCH_MS });
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' }),
  });
  await insertSession(
    db,
    buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: 'Retry webhooks' }),
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow-release', ?, 'Release checklist', 1, 1)",
    [WORKSPACE_ID],
  );
  await db.execute(
    "INSERT INTO steps (id, workflow_id, ordinal, name) VALUES ('step-implement', 'workflow-release', 0, 'implement')",
  );
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, notificationScope: 'workspace' });
});

describe('one event settles the standing and the bell', () => {
  it('clears the session error and the bell row together when the step was retried', async () => {
    await seedScene({ isRetried: true });
    expect(await unreadRows()).toHaveLength(1);

    await useAppStore.getState().settleAttention({ sessionId: SESSION_ID });

    expect(await stateKindOf()).toBe('idle');
    expect(useAppStore.getState().sessions[0]?.state.kind).toBe('idle');
    expect(await unreadRows()).toEqual([]);
  });

  it('keeps both while the failed step is not retried', async () => {
    await seedScene({ isRetried: false });

    await useAppStore.getState().settleAttention({ sessionId: SESSION_ID });

    expect(await stateKindOf()).toBe('error');
    expect(useAppStore.getState().sessions[0]?.state.kind).toBe('error');
    expect(await unreadRows()).toHaveLength(1);
  });

  it('runs the sweep alone when no session is named', async () => {
    await seedScene({ isRetried: true });

    await useAppStore.getState().settleAttention({ sessionId: null });

    expect(await stateKindOf()).toBe('error');
    expect(await unreadRows()).toEqual([]);
  });

  it('keeps the old state and shows the error when the write fails', async () => {
    await seedScene({ isRetried: true });
    await storySqlite().execute(
      "CREATE TRIGGER block_repair BEFORE UPDATE OF state_kind ON sessions BEGIN SELECT RAISE(ABORT, 'locked'); END",
    );

    await useAppStore.getState().settleAttention({ sessionId: SESSION_ID });

    expect(useAppStore.getState().sessions[0]?.state.kind).toBe('error');
    expect(await stateKindOf()).toBe('error');
    const titles = await rowsOf<{ title: string }>({
      sql: 'SELECT title FROM notifications WHERE read = 0',
    });
    expect(titles.map((row) => row.title)).toEqual(["Couldn't tidy the session state"]);
  });

  it('leaves the old state after the same call twice: the second finds nothing to change', async () => {
    await seedScene({ isRetried: true });

    await useAppStore.getState().settleAttention({ sessionId: SESSION_ID });
    await useAppStore.getState().settleAttention({ sessionId: SESSION_ID });

    expect(await stateKindOf()).toBe('idle');
  });
});
