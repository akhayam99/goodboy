import { setArtifactCommentsStatus } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { ArtifactId } from '@goodboy/types';
import { buildPlanCommentRequest } from '../../../features/plans/planComments/buildPlanCommentRequest';
import { sortByAnchor } from '../../../features/plans/planComments/planCommentAnchors';
import { planCommentsTargetOf } from '../../../features/plans/planComments/planCommentsTargetOf';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshArtifactComments } from './refresh';
import type { GetFn, SendArtifactCommentsParams, SendArtifactCommentsResult, SetFn } from './types';

type Deps = Readonly<{
  set: SetFn;
  get: GetFn;
}>;

const IN_FLIGHT = new Set<ArtifactId>();

export const sendArtifactCommentsToAgent = ({ set, get }: Deps) => {
  return async ({
    sessionId,
    plan,
  }: SendArtifactCommentsParams): Promise<SendArtifactCommentsResult> => {
    if (IN_FLIGHT.has(plan.id)) {
      return { kind: 'busy' };
    }
    const drafts = sortByAnchor({
      comments: (get().artifactComments[sessionId] ?? []).filter(
        (comment) => comment.artifactId === plan.id && comment.status === 'draft',
      ),
    });
    if (drafts.length === 0) {
      return { kind: 'empty' };
    }
    const target = planCommentsTargetOf({
      plan,
      agents: get().sessionPhaseRuns[sessionId] ?? [],
    });
    if (target === null || !target.canReceive) {
      return {
        kind: 'blocked',
        reason: `${target?.name ?? 'The agent'} isn't running. Copy the comments instead.`,
      };
    }
    const ids = drafts.map((comment) => comment.id);
    const content = buildPlanCommentRequest({
      clusters: plan.clusters ?? [],
      comments: drafts,
      purpose: 'read',
    });
    IN_FLIGHT.add(plan.id);
    try {
      const result = await get().sendTurn({ sessionId, agentId: target.agentId, content });
      if (result.blockedOverBudget) {
        return {
          kind: 'failed',
          reason: 'The session budget is reached. Raise it to send these comments.',
        };
      }
      if (result.isWriterLeaseDenied === true) {
        return {
          kind: 'failed',
          reason: 'Another agent is writing in this folder. Try again in a moment.',
        };
      }
      await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'sent' });
      await refreshArtifactComments({ set, sessionId });
      return { kind: 'sentToAgent', agentName: target.name };
    } catch (cause) {
      return { kind: 'failed', reason: formatError(cause) };
    } finally {
      IN_FLIGHT.delete(plan.id);
    }
  };
};
