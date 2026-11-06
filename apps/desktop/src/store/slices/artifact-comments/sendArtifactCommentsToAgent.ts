import { setArtifactCommentsStatus } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { consumerDelivery } from '../../../features/plans/planComments/consumerDelivery';
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

const IN_FLIGHT = new Map<ArtifactId, symbol>();

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
    const ids = [...new Set(drafts.map((comment) => comment.id))];
    const turnId = crypto.randomUUID();
    const content = buildPlanCommentRequest({
      clusters: plan.clusters ?? [],
      comments: drafts,
      purpose: 'read',
    });
    const token = Symbol(plan.id);
    IN_FLIGHT.set(plan.id, token);
    const release = (): void => {
      if (IN_FLIGHT.get(plan.id) === token) {
        IN_FLIGHT.delete(plan.id);
      }
    };
    let flip: Promise<boolean> | undefined;
    const markSent = (): Promise<boolean> => {
      flip ??= (async () => {
        try {
          await setArtifactCommentsStatus({
            db: tauriDatabase,
            ids,
            status: 'sent',
            sentTurnId: consumerDelivery.turnIdOf({ turnId }),
          });
          await refreshArtifactComments({ set, sessionId });
          return true;
        } catch (error) {
          void get().reportError({
            title: "Couldn't mark the comments as sent",
            error,
            sessionId,
          });
          return false;
        }
      })();
      return flip;
    };
    const sentOf = async (): Promise<SendArtifactCommentsResult> =>
      (await markSent())
        ? { kind: 'sentToAgent', agentName: target.name }
        : {
            kind: 'failed',
            reason: `${target.name} has the comments, but they could not be marked as sent.`,
          };
    try {
      if (isAgentBusy({ get, agentId: target.agentId, sessionId })) {
        const turn = {
          id: turnId,
          agentId: target.agentId,
          content,
          attachments: [],
          override: undefined,
        };
        const isSaved = await get().enqueueAgentMessage({ turn });
        if (!isSaved) {
          await get().removeQueuedMessage({ sessionId, agentId: target.agentId, itemId: turn.id });
          const isTaken = (get().agentQueue[target.agentId] ?? []).some(
            (item) => item.id === turn.id,
          );
          if (!isTaken) {
            return { kind: 'failed', reason: "The message couldn't be queued. Try again." };
          }
        }
        return await sentOf();
      }
      const result = await get().sendTurn({
        sessionId,
        agentId: target.agentId,
        content,
        origin: 'operator',
        onStarted: () => {
          void markSent().then(release);
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
      return await sentOf();
    } catch (cause) {
      if (flip !== undefined) {
        return await sentOf();
      }
      return { kind: 'failed', reason: formatError(cause) };
    } finally {
      release();
    }
  };
};
