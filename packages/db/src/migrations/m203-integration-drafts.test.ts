import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { m203IntegrationDrafts } from './m203-integration-drafts';

describe('m203 integration drafts', () => {
  it('stores durable drafts and removes them with their session', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 190 });
    await db.exec(m203IntegrationDrafts);
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES ('session', 'workspace', 'Refund split', 'idle', 1, 1)`,
    );
    await db.execute(
      `INSERT INTO integration_drafts
        (id, workspace_id, session_id, provider, verb, target_json, body, status, created_at, updated_at)
       VALUES
        ('draft', 'workspace', 'session', 'slack', 'reply', '{"channelId":"C1","threadTs":"1.0"}', 'Ready', 'pending', 1, 1)`,
    );

    expect(await db.select('SELECT id, status FROM integration_drafts')).toEqual([
      { id: 'draft', status: 'pending' },
    ]);
    await db.execute("DELETE FROM sessions WHERE id = 'session'");
    expect(await db.select('SELECT id FROM integration_drafts')).toEqual([]);
  });
});
