import type { SessionId } from '@goodboy/types';
import type { ShowToast } from '../../shared/components/Toast';
import type { StopWorkState } from '../../store/runtime/live-work/stopWork';
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
  const result = await stopAllRunningAgents({ getState, sessionId });
  const message = stopAllMessageOf({ result });
  const agentIds = result.stoppedAgentIds;
  if (offerResume({ getState, sessionId, agentIds, message, showToast }) === null) {
    showToast({ kind: 'info', message });
  }
};
