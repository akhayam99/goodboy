import { evaluateClusterExecutionEligibility } from '@goodboy/core';
import { recordClusterExecutionEligibility } from '@goodboy/db';
import type {
  AgentId,
  CheckoutCleanliness,
  ClusterExecutionEligibility,
  SessionId,
} from '@goodboy/types';
import { readCheckoutCleanliness } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { mergeClusterExecutionEligibility } from './mergeClusterAttempt';
import { resolveClusterSessionTarget } from './resolveClusterSessionTarget';
import type { GetFn, SetFn } from './types';

export type EvaluateExecutionEligibilityInput = {
  readonly sessionId: SessionId;
  readonly containerAgentId: AgentId;
};

type RecordParams = {
  readonly set: SetFn;
  readonly eligibility: Omit<ClusterExecutionEligibility, 'evaluatedAt'>;
};

export const persistExecutionEligibility = async ({
  set,
  eligibility,
}: RecordParams): Promise<ClusterExecutionEligibility> => {
  const stored = await recordClusterExecutionEligibility({ db: tauriDatabase, eligibility });
  set((state) => mergeClusterExecutionEligibility({ state, eligibility: stored }));
  return stored;
};

export const evaluateExecutionEligibility = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    containerAgentId,
  }: EvaluateExecutionEligibilityInput): Promise<ClusterExecutionEligibility | null> => {
    const execution = (get().clusterExecutionGraphs?.[sessionId] ?? []).find(
      (graph) => graph.containerAgentId === containerAgentId,
    );
    if (execution === undefined) {
      return null;
    }
    const target = resolveClusterSessionTarget({ state: get(), sessionId });
    const cleanliness: CheckoutCleanliness | null =
      target === null ? null : await readCheckoutCleanliness({ path: target.mount.worktreePath });
    const verdict = evaluateClusterExecutionEligibility({
      graph: execution.graph,
      setup: target?.project.setup ?? null,
      target: cleanliness,
    });
    return persistExecutionEligibility({
      set,
      eligibility: {
        containerAgentId,
        sessionId,
        graphRevision: execution.revision,
        state: verdict.kind === 'eligible' ? 'eligible' : 'sequential',
        reason: verdict.kind === 'eligible' ? null : verdict.reason,
        targetMountId: target?.mount.mountId ?? null,
        targetHeadSha: verdict.kind === 'eligible' ? verdict.headSha : null,
      },
    });
  };
};
