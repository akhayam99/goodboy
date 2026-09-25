import { loadSessionTurnSpans } from './loadSessionTurnSpans';
import { loadWorkspaceDurationHistory } from './loadWorkspaceDurationHistory';
import { refreshTurnSpans } from './refreshTurnSpans';
import { durationEstimatesInitialState } from './state';
import type { DurationEstimatesSlice, GetFn, SetFn } from './types';

export const createDurationEstimatesSlice = (set: SetFn, get: GetFn): DurationEstimatesSlice => ({
  ...durationEstimatesInitialState,
  loadWorkspaceDurationHistory: loadWorkspaceDurationHistory(set),
  loadSessionTurnSpans: loadSessionTurnSpans(set),
  refreshTurnSpans: refreshTurnSpans(get),
});
