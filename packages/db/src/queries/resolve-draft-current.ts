import type { SessionId } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly fromRevision?: number;
};

type StatementParams = Omit<Params, 'db'>;
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
