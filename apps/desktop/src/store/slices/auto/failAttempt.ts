import type { AutoAttempt, AutoDelegation } from '@goodboy/db';
import { attemptEnvelope } from './attemptEnvelope';
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

export const failAttempt = ({
  ctx,
  delegation,
  attempt,
  generation,
  reason,
  outcome = 'failed',
  costUsd = 0,
}: FailAttemptParams): Promise<SettleAttemptOutcome> => {
  const envelope = {
    ...attemptEnvelope({
      delegation,
      attempt,
      generation,
      exit: outcome === 'stopped' ? 'cancelled' : 'error',
      isTimedOut: outcome === 'timed_out',
      closing: null,
      costUsd,
    }),
    outcome,
    reason,
  };
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
  });
};
