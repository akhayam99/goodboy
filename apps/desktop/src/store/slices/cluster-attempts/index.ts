import { evaluateExecutionEligibility } from './evaluateExecutionEligibility';
import { prepareClusterAttempt } from './prepareClusterAttempt';
import type { GetFn, SetFn } from './types';

export { clusterAttemptsInitialState, type ClusterAttemptsState } from './state';

export const createClusterAttemptsSlice = (set: SetFn, get: GetFn) => ({
  evaluateClusterExecutionEligibility: evaluateExecutionEligibility(set, get),
  prepareClusterAttempt: prepareClusterAttempt(set, get),
});
