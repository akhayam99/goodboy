import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listSessionTitlesAcrossWorkspaces } from './session';

describe('listSessionTitlesAcrossWorkspaces', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at, deleted_at)
       VALUES ('ws-harborline', 'Harborline', '/tmp/harborline', 1, 1, NULL),
              ('ws-northwind', 'Northwind', '/tmp/northwind', 1, 1, NULL),
              ('ws-gone', 'Gone', '/tmp/gone', 1, 1, 5)`,
    );
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, archived_at, deleted_at)
       VALUES ('s-payout', 'ws-harborline', 'Speed up the payout export', 'running', 1, 30, NULL, NULL),
              ('s-webhook', 'ws-northwind', 'Stop retried webhooks', 'idle', 1, 40, NULL, NULL),
              ('s-archived', 'ws-northwind', 'Old ledger cleanup', 'idle', 1, 50, 60, NULL),
              ('s-deleted', 'ws-harborline', 'Deleted draft', 'idle', 1, 70, NULL, 80),
              ('s-orphan', 'ws-gone', 'In a removed workspace', 'idle', 1, 90, NULL, NULL)`,
    );
  });

  it('lists live sessions of every workspace, newest first', async () => {
    const refs = await listSessionTitlesAcrossWorkspaces({ db });

    expect(refs.map((ref) => [ref.sessionId, ref.workspaceId])).toEqual([
      ['s-webhook', 'ws-northwind'],
      ['s-payout', 'ws-harborline'],
    ]);
  });

  it('carries the goal, the turn state and the update time', async () => {
    const [, payout] = await listSessionTitlesAcrossWorkspaces({ db });

    expect(payout).toEqual({
      sessionId: 's-payout',
      workspaceId: 'ws-harborline',
      goal: 'Speed up the payout export',
      stateKind: 'running',
      updatedAt: new Date(30).toISOString(),
    });
  });
});
