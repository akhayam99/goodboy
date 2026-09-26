import {
  applyDecisionOpsToSession,
  type AppliedDecisionOps,
  type DecisionActor,
  type DecisionOp,
} from '@goodboy/core';
import { listContextSlotsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { decisionsChangedPayload } from './decisionsChangedPayload';
import { withDecisionsSlot } from './withDecisionsSlot';
import type { GetFn, SetFn } from './types';

export type ApplySessionDecisionOpsParams = {
  readonly sessionId: SessionId;
  readonly ops: ReadonlyArray<DecisionOp>;
  readonly actor: DecisionActor;
  readonly consolidatedAfter?: string;
};

export const applySessionDecisionOps = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    ops,
    actor,
    consolidatedAfter,
  }: ApplySessionDecisionOpsParams): Promise<AppliedDecisionOps> => {
    const applied = await applyDecisionOpsToSession({ db: tauriDatabase, sessionId, ops, actor });
    const slots = await listContextSlotsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionDecisions: { ...state.sessionDecisions, [sessionId]: applied.ledger },
      sessionSlots: withDecisionsSlot({ state, sessionId, slots }),
    }));
    const payload = decisionsChangedPayload({
      changes: applied.changes,
      ...(consolidatedAfter !== undefined && { consolidatedAfter }),
    });
    if (payload !== null) {
      await get().recordSessionEvent({ sessionId, kind: 'decisions_changed', payload });
    }
    return applied;
  };
};
