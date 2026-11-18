import { fixRunPhraseOf, type FixRun } from './fixRun';
import type { LaneStatus } from './laneStatus';

type Params = {
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
};

export const commentTabLiveOf = ({ run, lane }: Params): string | null => {
  if (lane !== null) {
    return lane.line;
  }
  return run === null ? null : fixRunPhraseOf({ run });
};
