import { setArtifactCommentsStatus } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { ArtifactComment, ArtifactId, PlanWithCount, TurnEvent } from '@goodboy/types';
import {
  annotateArtifactRevision,
  listArtifactsForSession,
} from '../../../features/artifacts/artifacts';
import { listPlansForSession } from '../../../features/plans/plans';
import { anchorHead, sortByAnchor } from '../../../features/plans/planComments/planCommentAnchors';
import { buildPlanCommentRequest } from '../../../features/plans/planComments/buildPlanCommentRequest';
import { planCommentGuard } from '../../../features/plans/planComments/planCommentGuard';
import { tauriDatabase } from '../../../shared/lib/db';
import { sessionById } from '../sessions/sessionIndex';
import { refreshArtifactComments } from './refresh';
import { settleAgainstVersions } from './settleSentComments';
import type { GetFn, SendArtifactCommentsParams, SendArtifactCommentsResult, SetFn } from './types';

const ASK_LIMIT = 240;

const putSending = ({
  set,
  artifactId,
  isSending,
}: {
  readonly set: SetFn;
  readonly artifactId: ArtifactId;
  readonly isSending: boolean;
}) =>
  set((state) => {
    const next = { ...state.artifactCommentSends };
    if (isSending) {
      return { artifactCommentSends: { ...next, [artifactId]: true as const } };
    }
    delete next[artifactId];
    return { artifactCommentSends: next };
  });

const sentTurnIdOf = ({
  events,
  content,
}: {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly content: string;
}): string | null => {
  const event = [...events]
    .reverse()
    .find((candidate) => candidate.kind === 'user_text' && candidate.text === content);
  return event !== undefined && event.kind === 'user_text' ? event.runId : null;
};

const askOf = ({ comments }: { readonly comments: ReadonlyArray<ArtifactComment> }): string => {
  const joined = comments.map((comment) => comment.body.trim()).join(' / ');
  return joined.length <= ASK_LIMIT ? joined : `${joined.slice(0, ASK_LIMIT).trimEnd()}...`;
};

const pinnedOf = ({ comments }: { readonly comments: ReadonlyArray<ArtifactComment> }) => ({
  scope: 'all' as const,
  screenId: null,
  nodes: comments.map((comment) => ({
    nodeId: comment.anchor.kind === 'part' ? `part:${comment.anchor.index + 1}` : comment.id,
    label: anchorHead({ anchor: comment.anchor }).replace(/:$/, ''),
  })),
});

export const sendArtifactComments = (set: SetFn, get: GetFn) => {
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
    const guard = planCommentGuard({
      plan,
      agents: get().sessionPhaseRuns[sessionId] ?? [],
      runs: sessionById(get().sessions, sessionId)?.workflowRuns ?? [],
    });
    if (!guard.canSend) {
      return { kind: 'blocked', reason: guard.reason ?? 'Comments cannot be sent now.' };
    }
    const sentAt = Date.now();
    const sentRevision =
      get().sessionArtifacts[sessionId]?.find((artifact) => artifact.id === plan.id)?.revision ?? 1;
    const ids = drafts.map((comment) => comment.id);
    const content = buildPlanCommentRequest({ clusters: plan.clusters ?? [], comments: drafts });
    putSending({ set, artifactId: plan.id, isSending: true });
    await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'sent' });
    await refreshArtifactComments({ set, sessionId });
    const revert = async (reason: string): Promise<SendArtifactCommentsResult> => {
      await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'draft' });
      putSending({ set, artifactId: plan.id, isSending: false });
      await refreshArtifactComments({ set, sessionId });
      return { kind: 'failed', reason };
    };
    let result: Awaited<ReturnType<ReturnType<GetFn>['sendTurn']>>;
    try {
      result = await get().sendTurn({ sessionId, agentId: plan.agentId, content });
    } catch (cause) {
      return await revert(formatError(cause));
    }
    if (result.blockedOverBudget) {
      return await revert('The session budget is reached. Raise it to send these comments.');
    }
    if (result.isWriterLeaseDenied === true) {
      return await revert('Another agent is writing in this folder. Try again in a moment.');
    }
    const sentTurnId = sentTurnIdOf({ events: get().transcripts[plan.agentId] ?? [], content });
    await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'sent', sentTurnId });
    const [artifacts, plans] = await Promise.all([
      listArtifactsForSession(sessionId).catch(() => null),
      listPlansForSession(sessionId).catch(() => null),
    ]);
    set((state) => ({
      ...(artifacts === null
        ? {}
        : { sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts } }),
      ...(plans === null ? {} : { sessionPlans: { ...state.sessionPlans, [sessionId]: plans } }),
    }));
    const landed = artifacts?.find((artifact) => artifact.id === plan.id) ?? null;
    const updated: PlanWithCount | null =
      plans?.find((candidate) => candidate.id === plan.id) ?? null;
    if (landed === null || updated === null || landed.revision <= sentRevision) {
      await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'open' });
      putSending({ set, artifactId: plan.id, isSending: false });
      await refreshArtifactComments({ set, sessionId });
      return { kind: 'unchanged' };
    }
    await annotateArtifactRevision({
      artifactId: plan.id,
      revision: landed.revision,
      note: {
        author: 'agent',
        ask: askOf({ comments: drafts }),
        pinned: pinnedOf({ comments: drafts }),
      },
    }).catch(() => false);
    const settlement = await settleAgainstVersions({
      comments: drafts,
      before: { bodyMd: plan.bodyMd, clusters: plan.clusters ?? [] },
      after: { bodyMd: updated.bodyMd, clusters: updated.clusters ?? [] },
    });
    putSending({ set, artifactId: plan.id, isSending: false });
    await refreshArtifactComments({ set, sessionId });
    return {
      kind: 'revised',
      revision: landed.revision,
      addressed: settlement.addressed.length,
      open: settlement.open.length,
    };
  };
};
