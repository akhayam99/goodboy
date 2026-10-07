import type { ResolveThread, SessionId } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly fromRevision?: number;
};

type StatementParams = Omit<Params, 'db'>;
type BookkeepingParams = {
  readonly row: ResolveThread;
  readonly expectedRevision: number | null;
};
type RepairParams = { readonly db: Database; readonly sessionId: SessionId };

const UNDECIDED = `q.session_id = ? AND q.thread_id = ? AND q.superseded_at IS NULL
  AND q.approval_state IN ('none', 'deferred') AND q.delivered_at IS NULL AND q.integrated_sha IS NULL`;

const LAGGING = `q.session_id = ? AND q.superseded_at IS NULL
  AND q.approval_state IN ('none', 'deferred') AND q.delivered_at IS NULL AND q.integrated_sha IS NULL
  AND q.candidate_revision < (SELECT r.revision FROM resolve_threads r WHERE r.session_id = q.session_id AND r.thread_id = q.thread_id)
  AND (SELECT r.state FROM resolve_threads r WHERE r.session_id = q.session_id AND r.thread_id = q.thread_id)
    IN ('open', 'fixed', 'answered', 'closed')
  AND COALESCE((
    SELECT c.state FROM resolve_candidates c
    JOIN resolve_candidate_items i ON i.candidate_id = c.id
    WHERE i.queue_item_id = q.id
    ORDER BY c.created_at DESC, c.id DESC LIMIT 1
  ), 'ready') = 'ready'`;

const CURRENT = `(SELECT r.revision FROM resolve_threads r WHERE r.session_id = q.session_id AND r.thread_id = q.thread_id)`;

const SAME_ANSWER = `EXISTS (SELECT 1 FROM resolve_threads r
  WHERE r.session_id = q.session_id AND r.thread_id = q.thread_id
    AND (? IS NULL OR r.revision = ?)
    AND r.revision = q.candidate_revision
    AND (r.state = ? OR ? = 'closed')
    AND r.disposition IS ? AND r.reply_draft IS ? AND r.question IS ?
    AND r.fixup_of_sha IS ? AND r.replaces_sha IS ? AND r.commit_shas_json IS ?)`;

export const bookkeepingRebaseStatements = ({
  row,
  expectedRevision,
}: BookkeepingParams): ReadonlyArray<PlainStatement> => {
  const where = `${UNDECIDED} AND ${SAME_ANSWER}`;
  const params = [
    row.sessionId,
    row.threadId,
    expectedRevision,
    expectedRevision,
    row.state,
    row.state,
    row.disposition,
    row.replyDraft,
    row.question,
    row.fixupOfSha,
    row.replacesSha,
    row.commitShas === null ? null : JSON.stringify(row.commitShas),
  ];
  return [
    {
      sql: `UPDATE resolve_candidate_items
          SET item_revision = (SELECT q.candidate_revision + 1 FROM resolve_queue_items q WHERE q.id = resolve_candidate_items.queue_item_id)
          WHERE candidate_id IN (SELECT id FROM resolve_candidates WHERE state = 'ready')
            AND queue_item_id IN (SELECT q.id FROM resolve_queue_items q WHERE ${where})`,
      params,
    },
    {
      sql: `UPDATE resolve_queue_items AS q SET candidate_revision = candidate_revision + 1, updated_at = ?
          WHERE ${where}`,
      params: [Date.now(), ...params],
    },
  ];
};

export const keepResolveDraftCurrentStatements = ({
  sessionId,
  threadId,
  fromRevision,
}: StatementParams): ReadonlyArray<PlainStatement> => {
  const from = fromRevision === undefined ? '' : ' AND q.candidate_revision = ?';
  const fromParams = fromRevision === undefined ? [] : [fromRevision];
  const current = `(SELECT r.revision FROM resolve_threads r WHERE r.session_id = ? AND r.thread_id = ?)`;
  return [
    {
      sql: `UPDATE resolve_candidate_items SET item_revision = ${current}
          WHERE candidate_id IN (SELECT id FROM resolve_candidates WHERE state = 'ready')
            AND queue_item_id IN (SELECT q.id FROM resolve_queue_items q WHERE ${UNDECIDED}${from})`,
      params: [sessionId, threadId, sessionId, threadId, ...fromParams],
    },
    {
      sql: `UPDATE resolve_queue_items AS q SET candidate_revision = ${current}, updated_at = ?
          WHERE ${UNDECIDED}${from}`,
      params: [sessionId, threadId, Date.now(), sessionId, threadId, ...fromParams],
    },
  ];
};

export const keepResolveDraftCurrent = async ({
  db,
  sessionId,
  threadId,
  fromRevision,
}: Params): Promise<boolean> => {
  const [candidateItems, queueItems] = keepResolveDraftCurrentStatements({
    sessionId,
    threadId,
    fromRevision,
  });
  if (candidateItems === undefined || queueItems === undefined) {
    return false;
  }
  const outcome = await db.transaction({
    statements: [
      candidateItems,
      { ...queueItems, abortWhen: 'noChanges', abortCode: 'NOTHING_TO_KEEP' },
    ],
  });
  return outcome.status === 'committed';
};

export const repairLaggingResolveQueueItems = async ({
  db,
  sessionId,
}: RepairParams): Promise<number> => {
  const outcome = await db.transaction({
    statements: [
      {
        sql: `UPDATE resolve_candidate_items SET item_revision = (
            SELECT ${CURRENT} FROM resolve_queue_items q WHERE q.id = resolve_candidate_items.queue_item_id
          )
          WHERE candidate_id IN (SELECT id FROM resolve_candidates WHERE state = 'ready')
            AND queue_item_id IN (SELECT q.id FROM resolve_queue_items q WHERE ${LAGGING})`,
        params: [sessionId],
      },
      {
        sql: `UPDATE resolve_queue_items AS q SET candidate_revision = ${CURRENT}, updated_at = ?
          WHERE ${LAGGING}`,
        params: [Date.now(), sessionId],
      },
    ],
  });
  return outcome.status === 'committed' ? (outcome.results.at(-1)?.rowsAffected ?? 0) : 0;
};
