import type { AgentId, SessionId } from '@goodboy/types';
import { invokeAgentSetProviderSessionId } from '../../../../features/workflows/workflows';
import { CHECK_STATE } from '../../notifications/errorRecovery';
import type { GetFn, SetFn } from '../types';
import { leadDeliveryMemory } from './leadDeliveryMemory';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  runId: string;
  hasSucceeded: boolean;
  providerSessionId: string | null;
}>;

export const settleLeadTurn = async ({
  set,
  get,
  sessionId,
  agentId,
  runId,
  hasSucceeded,
  providerSessionId,
}: Params): Promise<void> => {
  if (!hasSucceeded) {
    leadDeliveryMemory.drop({ agentId, runId });
    return;
  }
  const held = leadDeliveryMemory.ack({ agentId, runId, sessionId: providerSessionId })?.heldInit;
  if (held === undefined || held === null || held.provider === undefined) {
    return;
  }
  const provider = held.provider;
  try {
    await invokeAgentSetProviderSessionId({
      id: agentId,
      providerSessionId: held.providerSessionId,
      providerSessionProviderId: provider,
    });
  } catch (error) {
    await get().reportError({
      recovery: CHECK_STATE,
      title: "Couldn't keep the Lead's new session",
      error,
      sessionId,
    });
    return;
  }
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((run) =>
        run.id === agentId
          ? {
              ...run,
              providerSessionId: held.providerSessionId,
              providerSessionProviderId: provider,
            }
          : run,
      ),
    },
  }));
  get().appendTurnEvent(agentId, sessionId, held);
};
