import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { isLiveSession } from '../../shared/utils/isLiveSession';
import type { OutputHandoff } from '../../shared/utils/outputHandoff';

type Params = {
  readonly sessionId: SessionId;
  readonly handoff: OutputHandoff;
};

export const queueConsoleHandoff = ({ sessionId, handoff }: Params): boolean => {
  const state = useAppStore.getState();
  if (!isLiveSession({ session: sessionById(state.sessions, sessionId) })) {
    return false;
  }
  const agentId = state.selectedAgentId[sessionId] ?? state.sessionPhaseRuns[sessionId]?.[0]?.id;
  if (agentId === undefined) {
    return false;
  }
  state.queueOutputHandoff({ agentId, handoff });
  return true;
};
