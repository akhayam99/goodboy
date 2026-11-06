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

type SendingParams = Readonly<{
  set: SetFn;
  artifactId: ArtifactId;
  isSending: boolean;
}>;

type FailedParams = Readonly<{ reason: string }>;

const putSending = ({ set, artifactId, isSending }: SendingParams) =>
  set((state) => {
    const next = { ...state.artifactCommentSends };
    if (isSending) {
      return { artifactCommentSends: { ...next, [artifactId]: true as const } };
    }
    delete next[artifactId];
    return { artifactCommentSends: next };
  });

const failed = ({ reason }: FailedParams): SendArtifactCommentsResult => ({
  kind: 'failed',
  reason,
});

export const sendArtifactCommentsToAgent = ({ set, get }: Deps) => {
  return async ({
    sessionId,
    plan,
  }: SendArtifactCommentsParams): Promise<SendArtifactCommentsResult> => {
    if (get().artifactCommentSends[plan.id] !== undefined) {
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
        reason: `${target?.name ?? 'The agent'} is not running. Copy the comments instead.`,
      };
    }
    const ids = drafts.map((comment) => comment.id);
    const content = buildPlanCommentRequest({
      clusters: plan.clusters ?? [],
      comments: drafts,
      purpose: 'read',
    });
    putSending({ set, artifactId: plan.id, isSending: true });
    try {
      const result = await get().sendTurn({ sessionId, agentId: target.agentId, content });
      if (result.blockedOverBudget) {
        return failed({
          reason: 'The session budget is reached. Raise it to send these comments.',
        });
      }
      if (result.isWriterLeaseDenied === true) {
        return failed({
          reason: 'Another agent is writing in this folder. Try again in a moment.',
        });
      }
      await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'sent' });
      await refreshArtifactComments({ set, sessionId });
      return { kind: 'sentToAgent', agentName: target.name };
    } catch (cause) {
      return failed({ reason: formatError(cause) });
    } finally {
      putSending({ set, artifactId: plan.id, isSending: false });
    }
  };
};
