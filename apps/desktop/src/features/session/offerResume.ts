import type { AgentId, SessionId } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import type { ShowToast } from '../../shared/components/Toast';
import type { AppStore } from '../../store/store';

export type ResumeState = Pick<AppStore, 'undoable' | 'continueStoppedAgent'>;

type Params = {
  readonly getState: () => ResumeState;
  readonly sessionId: SessionId;
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly message: string;
  readonly showToast: ShowToast;
};

export const offerResume = ({
  getState,
  sessionId,
  agentIds,
  message,
  showToast,
}: Params): string | null => {
  if (agentIds.length === 0) {
    return null;
  }
  return getState().undoable({
    message,
    showToast,
    actionLabel: NAMES.continue,
    doneMessage: agentIds.length === 1 ? 'Continued.' : `Continued ${agentIds.length} agents.`,
    undo: async () => {
      const results = await Promise.allSettled(
        agentIds.map((agentId) => getState().continueStoppedAgent({ sessionId, agentId })),
      );
      const failure = results.find((result) => result.status === 'rejected');
      if (failure !== undefined) {
        throw failure.reason;
      }
    },
  });
};
