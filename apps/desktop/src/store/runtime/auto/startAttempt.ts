import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  casAutoDelegationStateStatement,
  getAutoAttempt,
  getAutoDelegation,
  insertAutoAttemptStatement,
  type AutoAttempt,
  type AutoJsonObject,
  type Database,
  type Statement,
} from '@goodboy/db';
import type { AutoDelegationId, AutoTreeId } from '@goodboy/types';

export type StartAttemptParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId;
  generation: number;
  baseline: AutoJsonObject | null;
  writeSet: AutoJsonObject | null;
}>;

export type StartAttemptOutcome =
  | Readonly<{ kind: 'started'; attempt: AutoAttempt }>
  | Readonly<{ kind: 'refused'; reason: 'unknown_delegation' | 'not_startable' }>;

const ABORT_START_TREE = 'start_tree';
const ABORT_START_DELEGATION = 'start_delegation';

export const startAttempt = async ({
  db,
  ownerId,
  nowMs,
  treeId,
  delegationId,
  generation,
  baseline,
  writeSet,
}: StartAttemptParams): Promise<StartAttemptOutcome> => {
  const delegation = await getAutoDelegation({ db, delegationId });
  if (delegation === null || delegation.treeId !== treeId) {
    return { kind: 'refused', reason: 'unknown_delegation' };
  }
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_trees
        WHERE id = ? AND generation = ? AND stop_state = 'none' AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [treeId, generation, ...autoOwnerGuardParams({ ownerId, nowMs })],
      abortWhen: 'noRows',
      abortCode: ABORT_START_TREE,
    },
    casAutoDelegationStateStatement({
      delegationId,
      generation,
      from: ['accepted'],
      to: 'starting',
      abortCode: ABORT_START_DELEGATION,
    }),
    insertAutoAttemptStatement({
      id: delegation.firstAttemptId,
      delegationId,
      treeId,
      generation,
      baseline,
      writeSet,
      nowMs,
    }),
  ];
  const outcome = await db.transaction({ statements });
  if (outcome.status === 'aborted') {
    return { kind: 'refused', reason: 'not_startable' };
  }
  const attempt = await getAutoAttempt({ db, attemptId: delegation.firstAttemptId });
  if (attempt === null) {
    return { kind: 'refused', reason: 'not_startable' };
  }
  return { kind: 'started', attempt };
};
