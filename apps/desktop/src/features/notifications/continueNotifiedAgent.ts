import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { getSessionById } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import { useAppStore } from '../../store';
import { openAttentionTarget } from '../session/openAttentionTarget';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const isAgentLoaded = ({ sessionId, agentId }: Params): boolean =>
  useAppStore.getState().sessionPhaseRuns[sessionId]?.some((agent) => agent.id === agentId) ===
  true;

const continueInOwner = async ({ sessionId, agentId }: Params): Promise<void> => {
  if (!isAgentLoaded({ sessionId, agentId })) {
    const session = await getSessionById(tauriDatabase, sessionId);
    if (session === null) {
      throw new Error('This session no longer exists.');
    }
    const opening = await openAttentionTarget({
      target: { workspaceId: session.workspaceId, sessionId, reason: null, agentId },
    });
    if (opening !== 'landed') {
      return;
    }
  }
  await useAppStore.getState().continueStoppedAgent({ sessionId, agentId });
};

export const continueNotifiedAgent = ({ sessionId, agentId }: Params): void => {
  continueInOwner({ sessionId, agentId }).catch((error: unknown) => {
    void useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't continue the agent", error });
  });
};
