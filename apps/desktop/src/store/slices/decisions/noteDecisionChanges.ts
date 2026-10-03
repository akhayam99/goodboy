import type { DecisionChange } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { decisionsChangedPayload } from './decisionsChangedPayload';
import type { GetFn } from './types';

export type NoteDecisionChangesParams = {
  readonly sessionId: SessionId;
  readonly changes: ReadonlyArray<DecisionChange>;
  readonly agentId?: AgentId;
};

export const noteDecisionChanges = (get: GetFn) => {
  return async ({ sessionId, changes, agentId }: NoteDecisionChangesParams): Promise<void> => {
    if (changes.length === 0) {
      return;
    }
    await get().loadSessionDecisions(sessionId);
    const payload = decisionsChangedPayload({
      changes,
      ...(agentId !== undefined && { agentId }),
    });
    if (payload === null) {
      return;
    }
    await get().recordSessionEvent({ sessionId, kind: 'decisions_changed', payload });
  };
};
