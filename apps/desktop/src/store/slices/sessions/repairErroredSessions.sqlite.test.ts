import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertSession, insertWorkspace } from '@goodboy/db';
import { brandId } from '@goodboy/types';
import type {
  AgentId,
  AgentStatus,
  IsoDateTime,
  SessionId,
  StepId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
} from '../../storyHarness';
import { repairErroredSessions } from './repairErroredSessions';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const HARBORLINE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandId<SessionId>({ value: 'session-webhooks' });
const FAILED_AT = 1_790_000_000_000;
const LATER_AT = FAILED_AT + 60_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly status: AgentStatus;
  readonly completedAt?: number;
  readonly stepId?: string;
};

const seedAgent = async ({ id, ordinal, status, completedAt, stepId }: SeedParams) => {
  await insertAgent(storySqlite(), {
    id: brandId<AgentId>({ value: id }),
    sessionId: SESSION_ID,
    ordinal,
    name: `agent ${id}`,
    status,
    ...(completedAt === undefined
      ? {}
      : { completedAt: brandId<IsoDateTime>({ value: new Date(completedAt).toISOString() }) }),
    ...(stepId === undefined ? {} : { stepId: brandId<StepId>({ value: stepId }) }),
  });
};

const sessionRow = async () =>
  (
    await storySqlite().select<{
      state_kind: string;
      updated_at: number;
      last_activity_at: number | null;
    }>('SELECT state_kind, updated_at, last_activity_at FROM sessions WHERE id = ?', [SESSION_ID])
  )[0];

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({
      id: HARBORLINE_ID,
      name: 'Harborline',
      slug: 'harborline',
    }),
  });
  await insertSession(
    db,
    buildStorySession({ id: SESSION_ID, workspaceId: HARBORLINE_ID, goal: 'Retry webhooks' }),
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow-release', ?, 'Release checklist', 1, 1)",
    [HARBORLINE_ID],
  );
  await db.execute(
    "INSERT INTO steps (id, workflow_id, ordinal, name) VALUES ('step-implement', 'workflow-release', 0, 'implement')",
  );
  await db.execute(
    "UPDATE sessions SET state_kind = 'error', updated_at = 800, last_activity_at = 700 WHERE id = ?",
    [SESSION_ID],
  );
});

describe('the boot repair of a stale session error', () => {
  it('keeps the error when a failed agent is followed by a pending one', async () => {
    await seedAgent({ id: 'implement', ordinal: 0, status: 'failed', completedAt: FAILED_AT });
    await seedAgent({ id: 'verify', ordinal: 1, status: 'pending' });

    expect(await repairErroredSessions()).toBe(0);
    expect((await sessionRow())?.state_kind).toBe('error');
  });

  it('keeps the error when an unrelated agent completed after the failure', async () => {
    await seedAgent({ id: 'implement', ordinal: 0, status: 'failed', completedAt: FAILED_AT });
    await seedAgent({ id: 'scout', ordinal: 1, status: 'completed', completedAt: LATER_AT });

    expect(await repairErroredSessions()).toBe(0);
    expect((await sessionRow())?.state_kind).toBe('error');
  });

  it('keeps the error when no agent row shows a failure', async () => {
    await seedAgent({ id: 'scout', ordinal: 0, status: 'completed', completedAt: LATER_AT });

    expect(await repairErroredSessions()).toBe(0);
    expect((await sessionRow())?.state_kind).toBe('error');
  });

  it('repairs an error whose slot was re-run and leaves the times alone', async () => {
    await seedAgent({
      id: 'implement',
      ordinal: 0,
      status: 'failed',
      completedAt: FAILED_AT,
      stepId: 'step-implement',
    });
    await seedAgent({
      id: 'implement-retry',
      ordinal: 1,
      status: 'completed',
      completedAt: LATER_AT,
      stepId: 'step-implement',
    });

    expect(await repairErroredSessions()).toBe(1);
    expect(await sessionRow()).toEqual({
      state_kind: 'idle',
      updated_at: 800,
      last_activity_at: 700,
    });
  });

  it('is idempotent', async () => {
    await seedAgent({
      id: 'implement',
      ordinal: 0,
      status: 'failed',
      completedAt: FAILED_AT,
      stepId: 'step-implement',
    });
    await seedAgent({
      id: 'implement-retry',
      ordinal: 1,
      status: 'completed',
      completedAt: LATER_AT,
      stepId: 'step-implement',
    });

    await repairErroredSessions();

    expect(await repairErroredSessions()).toBe(0);
  });

  it('refuses the write while a live run owns the session', async () => {
    await seedAgent({
      id: 'implement',
      ordinal: 0,
      status: 'failed',
      completedAt: FAILED_AT,
      stepId: 'step-implement',
    });
    await seedAgent({
      id: 'implement-retry',
      ordinal: 1,
      status: 'completed',
      completedAt: LATER_AT,
      stepId: 'step-implement',
    });
    await seedAgent({ id: 'follow-up', ordinal: 2, status: 'running' });

    expect(await repairErroredSessions()).toBe(0);
    expect((await sessionRow())?.state_kind).toBe('error');
  });
});
