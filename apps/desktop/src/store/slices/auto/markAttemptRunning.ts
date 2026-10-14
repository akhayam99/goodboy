import {
  casAutoDelegationStateStatement,
  markAutoAttemptRunningStatement,
  type Database,
} from '@goodboy/db';
import type { AutoAttemptId, AutoDelegationId } from '@goodboy/types';

export type MarkAttemptRunningParams = Readonly<{
  db: Database;
  attemptId: AutoAttemptId;
  delegationId: AutoDelegationId;
  generation: number;
  runId: string;
}>;

export type MarkAttemptRunningOutcome = 'running' | 'lost';

export const markAttemptRunning = async ({
  db,
  attemptId,
  delegationId,
  generation,
  runId,
}: MarkAttemptRunningParams): Promise<MarkAttemptRunningOutcome> => {
  const outcome = await db.transaction({
    statements: [
      markAutoAttemptRunningStatement({
        attemptId,
        generation,
        runId,
        abortCode: 'running_attempt',
      }),
      casAutoDelegationStateStatement({
        delegationId,
        generation,
        from: ['starting'],
        to: 'running',
        abortCode: 'running_delegation',
      }),
    ],
  });
  return outcome.status === 'committed' ? 'running' : 'lost';
};
