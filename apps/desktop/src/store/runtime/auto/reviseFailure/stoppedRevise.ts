import type { AutoAttempt, AutoDelegation } from '@goodboy/db';
import { failAttempt } from '../failAttempt';
import type { FinishAttemptOutcome } from '../finishAttempt';
import type { ChildTurnEnded } from '../ports';
import type { AgentVerbContext } from '../verbContext';

type StoppedReviseParams = {
  readonly ctx: AgentVerbContext;
  readonly ended: ChildTurnEnded;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
};

export const stoppedRevise = async ({
  ctx,
  ended,
  delegation,
  attempt,
}: StoppedReviseParams): Promise<FinishAttemptOutcome> => {
  const settled = await failAttempt({
    ctx,
    delegation,
    attempt,
    generation: ended.generation,
    reason: delegation.isStopping && delegation.reason !== null ? delegation.reason : 'stopped',
    outcome: 'stopped',
    costUsd: ended.costUsd,
  });
  if (settled.kind === 'dropped') {
    return { kind: 'dropped', reason: settled.reason };
  }
  return { kind: 'ended', outcome: 'stopped', landing: 'none' };
};
