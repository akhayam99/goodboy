import { missedClosingOf } from '@goodboy/core/auto';
import type { AutoAttempt, AutoDelegation } from '@goodboy/db';
import { brandId, type ArtifactId } from '@goodboy/types';
import { closeNudgeOf } from './attemptBaseline';
import { attemptEnvelope } from './attemptEnvelope';
import { nudgedEvidenceOf } from './closeNudge/nudgedEvidenceOf';
import type { SettleAttemptOutcome } from './settleAttempt';
import type { AgentVerbContext } from './verbContext';

export type FailAttemptParams = Readonly<{
  ctx: AgentVerbContext;
  delegation: AutoDelegation;
  attempt: AutoAttempt;
  generation: number;
  reason: string;
  outcome?: 'failed' | 'blocked' | 'stopped' | 'timed_out';
  costUsd?: number | null;
}>;

export const failAttempt = async ({
  ctx,
  delegation,
  attempt,
  generation,
  reason,
  outcome = 'failed',
  costUsd = 0,
}: FailAttemptParams): Promise<SettleAttemptOutcome> => {
  const nudge = closeNudgeOf({ baseline: attempt.baseline });
  const evidence = nudge === null ? null : await nudgedEvidenceOf({ db: ctx.db, attempt });
  const envelope = {
    ...attemptEnvelope({
      delegation,
      attempt,
      generation,
      exit: outcome === 'stopped' ? 'cancelled' : 'error',
      isTimedOut: outcome === 'timed_out',
      closing: nudge === null ? null : missedClosingOf({ summary: nudge.tail }),
      costUsd,
    }),
    ...evidence,
    outcome,
    reason,
  };
  const artifactId = delegation.reviseOf;
  return ctx.scheduler.settleAttempt({
    attemptId: attempt.id,
    generation,
    ending: {
      kind: 'ended',
      outcome,
      endReason: reason,
      costUsd,
      resultSnapshot: { envelope },
    },
    ...(artifactId !== null && {
      revise: {
        delegationId: delegation.id,
        generation,
        artifactId: brandId<ArtifactId>({ value: artifactId }),
        outcome,
        reason: 'ended',
        failure: reason,
        result: envelope,
      },
    }),
  });
};
