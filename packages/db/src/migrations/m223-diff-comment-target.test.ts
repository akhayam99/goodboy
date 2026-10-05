import { describe, expect, it } from 'vitest';
import type { ProjectId, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';
import {
  assignDiffCommentTarget,
  insertDiffComment,
  listDiffCommentsForSession,
} from '../queries/diff-comment';

const SESSION = 'session' as SessionId;

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 222 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('payments-api', 'workspace', 'payments-api', '/repo/payments-api', 'repo', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Ledger export', 'idle', 1, 1)",
  );
  for (const [id, branch, index] of [
    ['mount-a', 'feat/export', 0],
    ['mount-b', 'feat/export-v2', 1],
  ] as const) {
    await db.execute(
      `INSERT INTO session_worktrees (id, session_id, project_id, worktree_path, last_worktree_path, branch, parallel_index, mount_name, is_attached, disk_state, revision, created_at, updated_at)
       VALUES (?, 'session', 'payments-api', ?, ?, ?, ?, 'payments-api', 1, 'present', 1, 1, 1)`,
      [id, `/wt/${id}`, `/wt/${id}`, branch, index],
    );
  }
  for (const id of ['used', 'used-g2', 'split', 'idle', 'unmounted']) {
    await db.execute(
      `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, author_kind)
       VALUES (?, 'session', 'src/ledger.ts', 'Cast the id', 'open', 1, 'user')`,
      [id],
    );
  }
  const attempt = async (id: string, mountId: string | null, threads: ReadonlyArray<string>) =>
    db.execute(
      `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, mount_id, created_at)
       VALUES (?, 'session', ?, 318, ?, 'anthropic', 'sonnet', 'finished', ?, 1)`,
      [id, `agent-${id}`, JSON.stringify(threads), mountId],
    );
  await attempt('a1', 'mount-a', ['note:used', 'note:used-g2:g2']);
  await attempt('a2', 'mount-a', ['note:split']);
  await attempt('a3', 'mount-b', ['note:split']);
  await attempt('a4', null, ['note:unmounted']);
  const result = await migrateThrough({ db, version: 223 });
  expect(result.applied).toEqual([223]);
  return db;
};

describe('m223 diff comment target', () => {
  it('assigns an old note only to the mount of a resolver that used it', async () => {
    const db = await seed();
    const notes = await listDiffCommentsForSession(db, SESSION);
    const byId = new Map(notes.map((note) => [note.id, note] as const));
    expect(byId.get('used')).toMatchObject({ projectId: 'payments-api', branch: 'feat/export' });
    expect(byId.get('used-g2')).toMatchObject({
      projectId: 'payments-api',
      branch: 'feat/export',
    });
  });

  it('leaves notes unassigned when no resolver used them or the provenance is ambiguous', async () => {
    const db = await seed();
    const notes = await listDiffCommentsForSession(db, SESSION);
    for (const id of ['split', 'idle', 'unmounted']) {
      const note = notes.find((candidate) => candidate.id === id);
      expect(note?.projectId).toBeUndefined();
      expect(note?.branch).toBeUndefined();
    }
  });

  it('stores the project and branch of a new note and lets one be assigned later', async () => {
    const db = await seed();
    const target = { projectId: 'payments-api' as ProjectId, branch: 'feat/export-v2' };
    await insertDiffComment(
      db,
      'fresh',
      SESSION,
      'src/page.tsx',
      'Link the export',
      undefined,
      undefined,
      target,
    );
    await assignDiffCommentTarget(db, 'idle', target);
    const notes = await listDiffCommentsForSession(db, SESSION);
    expect(notes.find((note) => note.id === 'fresh')).toMatchObject(target);
    expect(notes.find((note) => note.id === 'idle')).toMatchObject(target);
  });
});
