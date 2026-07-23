import type {
  IsoDateTime,
  PrReviewDraft,
  ReviewablePrProvider,
  ReviewDraftOrigin,
  ReviewDraftSide,
  ReviewDraftStatus,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type PrReviewDraftRow = {
  readonly id: string;
  readonly session_id: string;
  readonly provider: string;
  readonly repo: string;
  readonly pr_number: number;
  readonly path: string;
  readonly line: number;
  readonly start_line: number | null;
  readonly side: string;
  readonly body: string;
  readonly status: string;
  readonly origin: string;
  readonly created_at: string;
};

type ToDomainParams = {
  readonly row: PrReviewDraftRow;
};

const toDomain = ({ row }: ToDomainParams): PrReviewDraft => ({
  id: row.id,
  sessionId: row.session_id as SessionId,
  provider: row.provider as ReviewablePrProvider,
  repo: row.repo,
  prNumber: row.pr_number,
  path: row.path,
  line: row.line,
  startLine: row.start_line,
  side: row.side as ReviewDraftSide,
  body: row.body,
  status: row.status as ReviewDraftStatus,
  stale: false,
  origin: row.origin as ReviewDraftOrigin,
  createdAt: row.created_at as IsoDateTime,
});

const SELECT_COLUMNS = `id, session_id, provider, repo, pr_number, path, line, start_line, side, body, status, origin, created_at`;

type InsertParams = {
  readonly db: Database;
  readonly draft: PrReviewDraft;
};

export const insertPrReviewDraft = async ({ db, draft }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO pr_review_drafts
       (id, session_id, provider, repo, pr_number, path, line, start_line, side, body, status, origin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.sessionId,
      draft.provider,
      draft.repo,
      draft.prNumber,
      draft.path,
      draft.line,
      draft.startLine,
      draft.side,
      draft.body,
      draft.status,
      draft.origin,
      draft.createdAt,
    ],
  );
};

type ListForSessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listPrReviewDraftsForSession = async ({
  db,
  sessionId,
}: ListForSessionParams): Promise<ReadonlyArray<PrReviewDraft>> => {
  const rows = await db.select<PrReviewDraftRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM pr_review_drafts
      WHERE session_id = ?
      ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row }));
};

type UpdateBodyParams = {
  readonly db: Database;
  readonly id: string;
  readonly body: string;
};

export const updatePrReviewDraftBody = async ({
  db,
  id,
  body,
}: UpdateBodyParams): Promise<void> => {
  await db.execute(`UPDATE pr_review_drafts SET body = ? WHERE id = ?`, [body, id]);
};

type DeleteParams = {
  readonly db: Database;
  readonly id: string;
};

export const deletePrReviewDraft = async ({ db, id }: DeleteParams): Promise<void> => {
  await db.execute(`DELETE FROM pr_review_drafts WHERE id = ?`, [id]);
};

type MarkPublishedParams = {
  readonly db: Database;
  readonly ids: ReadonlyArray<string>;
};

export const markPrReviewDraftsPublished = async ({
  db,
  ids,
}: MarkPublishedParams): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  const placeholders = ids.map(() => '?').join(', ');
  await db.execute(
    `UPDATE pr_review_drafts SET status = 'published' WHERE id IN (${placeholders})`,
    [...ids],
  );
};
