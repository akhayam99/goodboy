import type { SessionId } from '@goodboy/types';
import type { ShowToast } from '../../shared/components/Toast';
import type { StopWorkState } from '../../store/runtime/live-work/stopWork';
import { liveAgentsOf } from '../../store/runtime/live-work/liveAgentsOf';
import { offerResume, type ResumeState } from './offerResume';
import { stopAllMessageOf } from './stopAllMessageOf';
import { stopAllRunningAgents } from './stopAllRunningAgents';

type Params = {
  readonly getState: () => StopWorkState & ResumeState;
  readonly sessionId: SessionId;
  readonly showToast: ShowToast;
};

export const stopAllWithResume = async ({
  getState,
  sessionId,
  showToast,
}: Params): Promise<void> => {
  const live = liveAgentsOf({ state: getState(), sessionId });
  const result = await stopAllRunningAgents({ getState, sessionId });
  const message = stopAllMessageOf({ result });
  const agentIds = result.stopped === 0 ? [] : live.map((agent) => agent.id);
  if (offerResume({ getState, sessionId, agentIds, message, showToast }) === null) {
    showToast({ kind: 'info', message });
  }
};
