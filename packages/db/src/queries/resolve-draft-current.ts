import type { SessionId } from '@goodboy/types';
import type { Database } from '../client';

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly fromRevision?: number;
};

const UNDECIDED = `q.session_id = ? AND q.thread_id = ? AND q.superseded_at IS NULL
  AND q.approval_state = 'none' AND q.delivered_at IS NULL AND q.integrated_sha IS NULL`;

export const keepResolveDraftCurrent = async ({
  db,
  sessionId,
  threadId,
  fromRevision,
}: Params): Promise<boolean> => {
  const from = fromRevision === undefined ? '' : ' AND q.candidate_revision = ?';
  const fromParams = fromRevision === undefined ? [] : [fromRevision];
  const current = `(SELECT r.revision FROM resolve_threads r WHERE r.session_id = ? AND r.thread_id = ?)`;
  const outcome = await db.transaction({
    statements: [
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
        abortWhen: 'noChanges',
        abortCode: 'NOTHING_TO_KEEP',
      },
    ],
  });
  return outcome.status === 'committed';
};
