import type { ClusterAttemptBinding, ClusterExecutionEligibility, SessionId } from '@goodboy/types';

export type ClusterAttemptsState = {
  readonly clusterAttempts: Readonly<Record<SessionId, ReadonlyArray<ClusterAttemptBinding>>>;
  readonly clusterExecutionEligibility: Readonly<
    Record<SessionId, ReadonlyArray<ClusterExecutionEligibility>>
  >;
};

export const clusterAttemptsInitialState: ClusterAttemptsState = {
  clusterAttempts: {},
  clusterExecutionEligibility: {},
};
