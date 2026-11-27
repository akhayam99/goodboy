import { brandId } from '@goodboy/types';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listErroredSessionIds, repairSessionErrorState } from './session-error-repair';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-1' });
const sessionId = brandId<SessionId>({ value: 'session-1' });
const otherSessionId = brandId<SessionId>({ value: 'session-2' });

describe('repairSessionErrorState', () => {
  let db: Database;

  const stateOf = async ({ id }: { readonly id: string }) =>
    (
      await db.select<{ state_kind: string; updated_at: number; last_activity_at: number | null }>(
        'SELECT state_kind, updated_at, last_activity_at FROM sessions WHERE id = ?',
        [id],
      )
    )[0];

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [workspaceId, 'Harborline', '/tmp/harborline'],
    );
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at)
       VALUES (?, ?, 'Retry webhooks', 'error', 700, 1, 800),
              (?, ?, 'Roll out ledger-core', 'idle', 700, 1, 800)`,
      [sessionId, workspaceId, otherSessionId, workspaceId],
    );
  });

  it('lists the sessions whose stored state is error', async () => {
    expect(await listErroredSessionIds({ db })).toEqual([sessionId]);
  });

  it('writes the state and leaves updated_at and last_activity_at alone', async () => {
    const isRepaired = await repairSessionErrorState({ db, sessionId });

    expect(isRepaired).toBe(true);
    expect(await stateOf({ id: sessionId })).toEqual({
      state_kind: 'idle',
      updated_at: 800,
      last_activity_at: 700,
    });
  });

  it('is idempotent', async () => {
    await repairSessionErrorState({ db, sessionId });

    expect(await repairSessionErrorState({ db, sessionId })).toBe(false);
    expect((await stateOf({ id: sessionId }))?.state_kind).toBe('idle');
  });

  it('refuses the write while a live run owns the session', async () => {
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status)
       VALUES ('agent-live', ?, 0, 'notify-relay', 'running')`,
      [sessionId],
    );

    expect(await repairSessionErrorState({ db, sessionId })).toBe(false);
    expect((await stateOf({ id: sessionId }))?.state_kind).toBe('error');
  });

  it('never touches a session that is not in error', async () => {
    expect(await repairSessionErrorState({ db, sessionId: otherSessionId })).toBe(false);
    expect(await stateOf({ id: otherSessionId })).toEqual({
      state_kind: 'idle',
      updated_at: 800,
      last_activity_at: 700,
    });
  });
});
