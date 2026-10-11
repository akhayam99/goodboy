import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  insertDiffComment,
  listDiffCommentsForSession,
  updateDiffCommentBody,
} from './diff-comment';

const SESSION = 'session' as SessionId;

describe('diff comment body', () => {
  it('rewrites the body of one note and leaves the others and the anchor alone', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
    );
    await insertDiffComment(db, 'a', SESSION, 'src/ledger.ts', 'Cap the retries', {
      side: 'new',
      lineNumber: 14,
    });
    await insertDiffComment(db, 'b', SESSION, 'src/ledger.ts', 'Log the duplicate');

    await updateDiffCommentBody({ db, id: 'a', body: 'Cap the retries at three' });

    const notes = await listDiffCommentsForSession(db, SESSION);
    expect(notes.map((note) => [note.id, note.body])).toEqual([
      ['a', 'Cap the retries at three'],
      ['b', 'Log the duplicate'],
    ]);
    expect(notes[0]?.anchor).toEqual({ side: 'new', lineNumber: 14 });
  });
});
