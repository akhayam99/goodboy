import type { LaneRebuildFailure } from '../state';
import type { SessionParams, SetFn } from '../types';

type Params = SessionParams & {
  readonly set: SetFn;
  readonly failure: LaneRebuildFailure;
};

export const recordLaneRebuildFailure = ({ set, sessionId, failure }: Params): void => {
  set((state) => {
    const others = (state.sessionLaneRebuildFailures[sessionId] ?? []).filter(
      (entry) => entry.worktreePath !== failure.worktreePath,
    );
    return {
      sessionLaneRebuildFailures: {
        ...state.sessionLaneRebuildFailures,
        [sessionId]: [...others, failure],
      },
    };
  });
};
