import type { Agent, OpenQuestionId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { agentPlace } from '../../store/slices/navigation/place';
import { openAgentRevealEvent } from '../../shared/utils/openAgentReveal';
import { runPlace } from '../workflows/runPlace';

type Params = {
  readonly state: Pick<AppStore, 'navigate' | 'requestOpenQuestionScroll'>;
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
  state.navigate({ to: runPlace({ sessionId, runId, agentId: asker.id }) });
};
