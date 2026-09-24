import type { ClusterAttemptBinding, ClusterExecutionEligibility, SessionId } from '@goodboy/types';
import type { ClusterAttemptsState } from './state';

type MergeAttemptParams = {
  readonly state: ClusterAttemptsState;
  readonly attempt: ClusterAttemptBinding;
};

export const mergeClusterAttempt = ({
  state,
  attempt,
}: MergeAttemptParams): Pick<ClusterAttemptsState, 'clusterAttempts'> => {
  const current = state.clusterAttempts[attempt.sessionId] ?? [];
  const others = current.filter((candidate) => candidate.id !== attempt.id);
  return {
    clusterAttempts: { ...state.clusterAttempts, [attempt.sessionId]: [...others, attempt] },
  };
};

type MergeEligibilityParams = {
  readonly state: ClusterAttemptsState;
  readonly eligibility: ClusterExecutionEligibility;
};

export const mergeClusterExecutionEligibility = ({
  state,
  eligibility,
}: MergeEligibilityParams): Pick<ClusterAttemptsState, 'clusterExecutionEligibility'> => {
  const current = state.clusterExecutionEligibility[eligibility.sessionId] ?? [];
  const others = current.filter(
    (candidate) => candidate.containerAgentId !== eligibility.containerAgentId,
  );
  return {
    clusterExecutionEligibility: {
      ...state.clusterExecutionEligibility,
      [eligibility.sessionId]: [...others, eligibility],
    },
  };
};

type LedgerPatchParams = {
  readonly sessionIds: ReadonlyArray<SessionId>;
  readonly attempts: ReadonlyMap<SessionId, ReadonlyArray<ClusterAttemptBinding>>;
  readonly eligibility: ReadonlyMap<SessionId, ReadonlyArray<ClusterExecutionEligibility>>;
};

export const clusterAttemptLedgerPatch = ({
  sessionIds,
  attempts,
  eligibility,
}: LedgerPatchParams): ClusterAttemptsState => {
  const attemptRecord: Record<SessionId, ReadonlyArray<ClusterAttemptBinding>> = {};
  const eligibilityRecord: Record<SessionId, ReadonlyArray<ClusterExecutionEligibility>> = {};
  for (const sessionId of sessionIds) {
    attemptRecord[sessionId] = attempts.get(sessionId) ?? [];
    eligibilityRecord[sessionId] = eligibility.get(sessionId) ?? [];
  }
  return { clusterAttempts: attemptRecord, clusterExecutionEligibility: eligibilityRecord };
};
