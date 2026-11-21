import type { AgentId, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../shared/components/Toast';
import type { AppStore } from '../../store/store';
import { offerResume, type ResumeState } from '../session/offerResume';
import type { LaneStatus } from './laneStatus';

type Params = {
  readonly getState: () => Pick<AppStore, 'forceCloseResolver' | 'stopResolveLane'> & ResumeState;
  readonly showToast: ShowToast;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly lane: LaneStatus | null;
  readonly message: string;
};

export const stopFixWithResume = async ({
  getState,
  showToast,
  sessionId,
  agentId,
  lane,
  message,
}: Params): Promise<void> => {
  const stoppedIds: ReadonlyArray<AgentId> =
    lane === null
      ? (await getState().forceCloseResolver(sessionId, agentId)) === 'closed'
        ? [agentId]
        : []
      : await getState().stopResolveLane({ sessionId, worktreePath: lane.worktreePath });
  if (stoppedIds.length === 0) {
    return;
  }
  if (offerResume({ getState, sessionId, agentIds: stoppedIds, message, showToast }) === null) {
    showToast({ kind: 'info', message });
  }
};
