import type { Agent, OpenQuestionId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { isOrchestratedRun } from '../../store/slices/navigation/isOrchestratedRun';
import { agentPlace } from '../../store/slices/navigation/place';
import { openAgentRevealEvent } from '../../shared/utils/openAgentReveal';
import { runPlace } from '../workflows/runPlace';

type Params = {
  readonly state: Pick<
    AppStore,
    'sessions' | 'navigate' | 'openDrawer' | 'requestOpenQuestionScroll'
  >;
  readonly sessionId: SessionId;
  readonly asker: Agent;
  readonly questionId: OpenQuestionId;
};

export const openAsker = ({ state, sessionId, asker, questionId }: Params): void => {
  const runId = asker.workflowRunId ?? null;
  if (runId === null) {
    state.navigate({ to: agentPlace({ sessionId, agentId: asker.id }) });
    state.requestOpenQuestionScroll({ agentId: asker.id, questionId });
    window.dispatchEvent(openAgentRevealEvent());
    return;
  }
  if (isOrchestratedRun({ state, sessionId, runId })) {
    state.navigate({ to: runPlace({ sessionId, runId }) });
    state.openDrawer({ kind: 'run-step', sessionId, payload: { runId, agentId: asker.id } });
    return;
  }
  state.navigate({ to: runPlace({ sessionId, runId, agentId: asker.id }) });
};
