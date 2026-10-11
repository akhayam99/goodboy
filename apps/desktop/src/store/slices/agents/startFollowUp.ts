import type { AgentId, AgentSourceKind, MountId, PlanId, SessionId } from '@goodboy/types';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';
import { composeFollowUpSeed } from '../../../features/session/followUpMoves';
import type { SpawnFocus } from '../session-view/spawnFocus';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly sourceAgentId: AgentId;
  readonly kind: AgentKind;
  readonly routing: AgentKindRouting;
  readonly seed?: string;
  readonly summary?: string;
  readonly triggeredPlanId?: PlanId;
  readonly mountId?: MountId;
  readonly origin?: { readonly sourceKind: AgentSourceKind; readonly sourceCommentUrl: string };
  readonly focus?: SpawnFocus;
};

const pending = new Map<string, Promise<AgentId>>();

export const startFollowUp = (get: GetFn) => {
  return ({
    sessionId,
    sourceAgentId,
    kind,
    routing,
    seed,
    summary,
    triggeredPlanId,
    mountId,
    origin,
    focus = 'agent',
  }: Params): Promise<AgentId> => {
    const key = JSON.stringify([sessionId, sourceAgentId, kind, origin?.sourceCommentUrl ?? null]);
    const inFlight = pending.get(key);
    if (inFlight !== undefined) {
      return inFlight;
    }
    const state = get();
    const source = (state.sessionPhaseRuns[sessionId] ?? []).find(
      (agent) => agent.id === sourceAgentId,
    );
    if (source === undefined) {
      return Promise.reject(new Error('The agent to follow up on is no longer available.'));
    }
    if (origin !== undefined) {
      const existing = (state.sessionPhaseRuns[sessionId] ?? []).find(
        (agent) =>
          agent.parentAgentId === sourceAgentId &&
          agent.kind === kind &&
          agent.sourceCommentUrl === origin.sourceCommentUrl &&
          agent.deletedAt === undefined &&
          agent.status !== 'failed' &&
          agent.status !== 'stopped' &&
          agent.status !== 'skipped',
      );
      if (existing !== undefined) {
        return Promise.resolve(existing.id);
      }
    }
    const prompt =
      seed ??
      (triggeredPlanId === undefined
        ? composeFollowUpSeed({ sourceAgent: source, summary: summary ?? '' })
        : undefined);
    const result = state
      .spawnAgent(sessionId, {
        kindOverride: kind,
        ...routing,
        ...(triggeredPlanId !== undefined && { triggeredPlanId }),
        ...(prompt !== undefined && { initialPrompt: prompt }),
        ...(mountId !== undefined && { mountId }),
        ...(origin !== undefined && origin),
        parentAgentId: sourceAgentId,
        focus,
      })
      .finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  };
};
