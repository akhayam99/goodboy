import { describe, expect, it } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getDraftHistoryPlan, markHistoryPlan, saveDraftHistoryPlan } from './history-plan';

const SESSION = 'session-ledger' as SessionId;
const MOUNT = 'mount-ledger' as MountId;

const seeded = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-ledger', 'workspace', 'Ledger', 'idle', 1, 1)",
  );
  return db;
};

describe('history plans', () => {
  it('keeps one draft per mount and updates it in place', async () => {
    const db = await seeded();
    const first = await saveDraftHistoryPlan({
      db,
      sessionId: SESSION,
      mountId: MOUNT,
      branch: 'fix/ledger-postings',
      baseSha: 'base',
      headSha: 'head',
      items: [{ sha: 'a1', verb: 'pick' }],
      at: 10,
    });
    const second = await saveDraftHistoryPlan({
      db,
      sessionId: SESSION,
      mountId: MOUNT,
      branch: 'fix/ledger-postings',
      baseSha: 'base',
      headSha: 'head',
      items: [
        { sha: 'a1', verb: 'reword', message: 'Guard postings' },
        { sha: 'b2', verb: 'fixup', target: 'a1' },
      ],
      at: 20,
    });

    expect(second.id).toBe(first.id);
    expect(second.items).toEqual([
      { sha: 'a1', verb: 'reword', message: 'Guard postings' },
      { sha: 'b2', verb: 'fixup', target: 'a1' },
    ]);
    expect(second.updatedAt).toBe(20);
  });

  it('closes the draft when it is applied and records the push', async () => {
    const db = await seeded();
    const draft = await saveDraftHistoryPlan({
      db,
      sessionId: SESSION,
      mountId: MOUNT,
      branch: 'fix/ledger-postings',
      baseSha: 'base',
      headSha: 'head',
      items: [],
      at: 10,
    });
    await markHistoryPlan({ db, id: draft.id, state: 'applied', at: 30, backupRef: 'refs/b' });

    expect(await getDraftHistoryPlan({ db, mountId: MOUNT })).toBeNull();
    await markHistoryPlan({ db, id: draft.id, state: 'pushed', at: 40, remoteShaAtApply: 'r' });
    const rows = await db.select<{ readonly state: string; readonly pushed_at: number | null }>(
      'SELECT state, pushed_at FROM history_plans WHERE id = ?',
      [draft.id],
    );
    expect(rows).toEqual([{ state: 'pushed', pushed_at: 40 }]);
  });

  it('refuses a state the table does not know', async () => {
    const db = await seeded();
    await expect(
      db.execute(
        "INSERT INTO history_plans (id, session_id, mount_id, branch, base_sha, head_sha, state, created_at, updated_at) VALUES ('x', 'session-ledger', 'm', 'b', 'a', 'h', 'lost', 1, 1)",
      ),
    ).rejects.toThrow(/CHECK/i);
  });
});
