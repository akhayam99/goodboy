import type { DelegationResultV1 } from '@goodboy/core/auto';
import type { AutoAttempt, AutoDelegation } from '@goodboy/db';
import { brandId, type ArtifactId } from '@goodboy/types';
import type { FinishAttemptOutcome } from '../finishAttempt';
import type { ChildTurnEnded } from '../ports';
import type { AgentVerbContext } from '../verbContext';

type ReturnedReviseParams = {
  readonly ctx: AgentVerbContext;
  readonly ended: ChildTurnEnded;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly artifactId: string;
  readonly envelope: DelegationResultV1;
};

export const returnedRevise = async ({
  ctx,
  ended,
  delegation,
  attempt,
  artifactId,
  envelope,
}: ReturnedReviseParams): Promise<FinishAttemptOutcome> => {
  const result: DelegationResultV1 = { ...envelope, artifacts: [] };
  const settled = await ctx.scheduler.settleAttempt({
    attemptId: attempt.id,
    generation: ended.generation,
    ending: {
      kind: 'ended',
      outcome: 'blocked',
      endReason: result.reason,
      costUsd: ended.costUsd,
      resultSnapshot: { envelope: result, landing: null },
    },
    revise: {
      delegationId: delegation.id,
      generation: ended.generation,
      artifactId: brandId<ArtifactId>({ value: artifactId }),
      outcome: 'blocked',
      reason: 'returned',
      ...(result.reason !== null && { failure: result.reason }),
      result,
    },
  });
  if (settled.kind === 'dropped') {
    return { kind: 'dropped', reason: settled.reason };
  }
  return { kind: 'ended', outcome: 'blocked', landing: 'none' };
};
