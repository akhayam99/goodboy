import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PrReviewDraft, SessionId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from '../migrations';
import { migrate } from '../migrations/runner';
import {
  deletePrReviewDraft,
  insertPrReviewDraft,
  listPrReviewDraftsForSession,
  markPrReviewDraftsPublished,
  updatePrReviewDraftBody,
} from './pr-review-draft';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db, migrations);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

type MakeDraftParams = {
  readonly overrides?: Partial<PrReviewDraft>;
};

const makeDraft = ({ overrides = {} }: MakeDraftParams): PrReviewDraft => ({
  id: 'draft-1',
  sessionId,
  provider: 'github',
  repo: 'acme/web',
  prNumber: 42,
  path: 'src/a.ts',
  line: 10,
  startLine: null,
  side: 'new',
  body: 'consider a guard clause here',
  status: 'draft',
  stale: false,
  origin: 'agent',
  createdAt: new Date('2026-07-23T10:00:00Z').toISOString() as IsoDateTime,
  ...overrides,
});

describe('pr_review_drafts queries', () => {
  it('stores and lists drafts for a session in insertion order', async () => {
    const db = await seed();
    await insertPrReviewDraft({ db, draft: makeDraft({}) });
    await insertPrReviewDraft({
      db,
      draft: makeDraft({
        overrides: {
          id: 'draft-2',
          provider: 'gitlab',
          origin: 'user',
          startLine: 8,
          createdAt: new Date('2026-07-23T11:00:00Z').toISOString() as IsoDateTime,
        },
      }),
    });

    const drafts = await listPrReviewDraftsForSession({ db, sessionId });
    expect(drafts.map((draft) => draft.id)).toEqual(['draft-1', 'draft-2']);
    expect(drafts[0]).toEqual(makeDraft({}));
    expect(drafts[1]?.startLine).toBe(8);
    expect(drafts[1]?.origin).toBe('user');
  });

  it('rejects an unknown provider', async () => {
    const db = await seed();
    await expect(
      insertPrReviewDraft({ db, draft: makeDraft({ overrides: { provider: 'gitea' as never } }) }),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('updates only the matching draft body', async () => {
    const db = await seed();
    await insertPrReviewDraft({ db, draft: makeDraft({}) });
    await insertPrReviewDraft({ db, draft: makeDraft({ overrides: { id: 'draft-2' } }) });

    await updatePrReviewDraftBody({ db, id: 'draft-1', body: 'rewritten' });

    const drafts = await listPrReviewDraftsForSession({ db, sessionId });
    expect(drafts.map((draft) => draft.body)).toEqual([
      'rewritten',
      'consider a guard clause here',
    ]);
  });

  it('deletes only the matching draft', async () => {
    const db = await seed();
    await insertPrReviewDraft({ db, draft: makeDraft({}) });
    await insertPrReviewDraft({ db, draft: makeDraft({ overrides: { id: 'draft-2' } }) });

    await deletePrReviewDraft({ db, id: 'draft-1' });

    const drafts = await listPrReviewDraftsForSession({ db, sessionId });
    expect(drafts.map((draft) => draft.id)).toEqual(['draft-2']);
  });

  it('marks only the given ids as published', async () => {
    const db = await seed();
    await insertPrReviewDraft({ db, draft: makeDraft({}) });
    await insertPrReviewDraft({ db, draft: makeDraft({ overrides: { id: 'draft-2' } }) });
    await insertPrReviewDraft({ db, draft: makeDraft({ overrides: { id: 'draft-3' } }) });

    await markPrReviewDraftsPublished({ db, ids: ['draft-1', 'draft-3'] });
    await markPrReviewDraftsPublished({ db, ids: [] });

    const drafts = await listPrReviewDraftsForSession({ db, sessionId });
    expect(drafts.map((draft) => draft.status)).toEqual(['published', 'draft', 'published']);
  });

  it('cascade deletes drafts with their session', async () => {
    const db = await seed();
    await insertPrReviewDraft({ db, draft: makeDraft({}) });
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    expect(await listPrReviewDraftsForSession({ db, sessionId })).toEqual([]);
  });
});
