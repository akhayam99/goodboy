import { loadSessionTurnSpans } from './loadSessionTurnSpans';
import { loadWorkspaceDurationHistory } from './loadWorkspaceDurationHistory';
import { refreshTurnSpans } from './refreshTurnSpans';
import { durationEstimatesInitialState } from './state';
import type { DurationEstimatesSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createDurationEstimatesSlice = ({ set, get }: SliceDeps): DurationEstimatesSlice => ({
  ...durationEstimatesInitialState,
  loadWorkspaceDurationHistory: loadWorkspaceDurationHistory(set),
  loadSessionTurnSpans: loadSessionTurnSpans(set),
  refreshTurnSpans: refreshTurnSpans(get),
});
