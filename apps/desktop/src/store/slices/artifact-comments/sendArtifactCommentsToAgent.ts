import { setArtifactCommentsStatus } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
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

type BusyParams = Readonly<{
  get: GetFn;
  agentId: AgentId;
  sessionId: SessionId;
}>;

const isAgentBusy = ({ get, agentId, sessionId }: BusyParams): boolean => {
  const state = get().agentTurnState[agentId];
  if (state === undefined) {
    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
    return agent?.status === 'running';
  }
  return state.kind === 'starting' || state.kind === 'running';
};

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
    let flip: Promise<void> | undefined;
    const markSent = (): Promise<void> => {
      flip ??= (async () => {
        await setArtifactCommentsStatus({ db: tauriDatabase, ids, status: 'sent' });
        await refreshArtifactComments({ set, sessionId });
      })();
      return flip;
    };
    try {
      if (isAgentBusy({ get, agentId: target.agentId, sessionId })) {
        const turn = {
          id: crypto.randomUUID(),
          agentId: target.agentId,
          content,
          attachments: [],
          override: undefined,
        };
        await get().enqueueAgentMessage({ turn });
        const isQueued = (get().agentQueue[target.agentId] ?? []).some(
          (item) => item.id === turn.id,
        );
        if (!isQueued) {
          return { kind: 'failed', reason: "The message couldn't be queued. Try again." };
        }
        await markSent();
        return { kind: 'sentToAgent', agentName: target.name };
      }
      const result = await get().sendTurn({
        sessionId,
        agentId: target.agentId,
        content,
        origin: 'operator',
        onStarted: () => {
          void markSent().catch(() => undefined);
        },
      });
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
      if (flip === undefined && result.isLaneQueued !== true && result.isAlreadySent !== true) {
        return { kind: 'failed', reason: "The agent didn't take the message. Try again." };
      }
      await markSent();
      return { kind: 'sentToAgent', agentName: target.name };
    } catch (cause) {
      if (flip !== undefined) {
        const isFlipped = await flip.then(
          () => true,
          () => false,
        );
        if (isFlipped) {
          return { kind: 'sentToAgent', agentName: target.name };
        }
      }
      return { kind: 'failed', reason: formatError(cause) };
    } finally {
      IN_FLIGHT.delete(plan.id);
    }
  };
};
