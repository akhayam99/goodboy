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
import type { LaunchGuardRows } from '@goodboy/core/auto';
import type { AutoDelegationId, AutoTreeId } from '@goodboy/types';
import { launchGuardStart } from './launchGuard/launchGuardStart';

export type StartAttemptParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId;
  generation: number;
  baseline: AutoJsonObject | null;
  writeSet: AutoJsonObject | null;
  launchSnapshot?: AutoJsonObject | null;
  guardRows?: LaunchGuardRows | null;
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
  launchSnapshot = null,
  guardRows = null,
}: StartAttemptParams): Promise<StartAttemptOutcome> => {
  const delegation = await getAutoDelegation({ db, delegationId });
  if (delegation === null || delegation.treeId !== treeId) {
    return { kind: 'refused', reason: 'unknown_delegation' };
  }
  const guarded = await launchGuardStart({ db, nowMs, delegation, writeSet, rows: guardRows });
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
    ...guarded.statements,
    insertAutoAttemptStatement({
      id: delegation.firstAttemptId,
      delegationId,
      treeId,
      generation,
      baseline,
      writeSet: guarded.writeSet,
      launchSnapshot,
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
