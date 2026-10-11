import type { Agent, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns'>;
  readonly sessionId: SessionId;
  readonly url: string;
};

export const selectCheckAnalysis = ({ state, sessionId, url }: Params): Agent | null =>
  (state.sessionPhaseRuns[sessionId] ?? []).reduce<Agent | null>((latest, agent) => {
    if (
      agent.sourceKind !== 'failed_check' ||
      agent.sourceCommentUrl !== url ||
      agent.parentAgentId !== undefined ||
      agent.deletedAt !== undefined
    ) {
      return latest;
    }
    return latest === null || agent.ordinal > latest.ordinal ? agent : latest;
  }, null);
