import type { ResolveThread } from '@goodboy/types';
import type { Database, Statement } from '../client';
import { upsertResolveThreadStatement } from './resolve-thread';

type DiscardedThread = {
  readonly row: ResolveThread;
  readonly expectedRevision: number;
  readonly itemId: string;
};

type Params = {
  readonly db: Database;
  readonly candidateId: string | null;
  readonly threads: ReadonlyArray<DiscardedThread>;
};

type CandidateParams = {
  readonly candidateId: string | null;
  readonly now: number;
};

type MemberParams = DiscardedThread & {
  readonly now: number;
};

const candidateStatements = ({ candidateId, now }: CandidateParams): ReadonlyArray<Statement> =>
  candidateId === null
    ? []
    : [
        {
          sql: "UPDATE resolve_candidates SET state = 'discarded', updated_at = ? WHERE id = ? AND state = 'ready'",
          params: [now, candidateId],
          abortWhen: 'noChanges',
          abortCode: 'CANDIDATE_CHANGED',
        },
      ];

const memberStatements = ({
  row,
  expectedRevision,
  itemId,
  now,
}: MemberParams): ReadonlyArray<Statement> => [
  {
    ...upsertResolveThreadStatement({ row, expectedRevision }),
    abortWhen: 'noChanges',
    abortCode: 'THREAD_CHANGED',
  },
  {
    sql: `UPDATE resolve_queue_items SET candidate_revision = ?, updated_at = ?
       WHERE id = ? AND session_id = ? AND superseded_at IS NULL AND approval_state = 'none'
         AND delivered_at IS NULL AND integrated_sha IS NULL`,
    params: [expectedRevision + 1, now, itemId, row.sessionId],
    abortWhen: 'noChanges',
    abortCode: 'ITEM_CHANGED',
  },
];

export const discardResolveFix = async ({ db, candidateId, threads }: Params): Promise<boolean> => {
  const now = Date.now();
  const outcome = await db.transaction({
    statements: [
      ...candidateStatements({ candidateId, now }),
      ...threads.flatMap((thread) => memberStatements({ ...thread, now })),
    ],
  });
  return outcome.status === 'committed';
};
