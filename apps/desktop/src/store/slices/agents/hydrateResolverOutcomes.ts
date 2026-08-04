import type { AgentId, SessionId } from '@goodboy/types';
import { listMessagesForAgent } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { classifyAgent } from '../../../features/session/agent-kind';
import { resolverTurnOutcomes } from '../../../features/session/resolverTurnOutcomes';
import type { ResolverThreadOutcome } from '../../types';
import type { GetFn, SetFn } from './types';

const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

export const hydrateResolverOutcomes = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const resolvers = runs.filter(
      (agent) =>
        agent.parentAgentId == null &&
        agent.stepId == null &&
        get().resolverThreadOutcomes[agent.id] === undefined &&
        classifyAgent(agent, get().agentKindOverride[agent.id] ?? null) === 'resolver',
    );
    if (resolvers.length === 0) {
      return;
    }
    const rebuilt = await Promise.all(
      resolvers.map(async (agent) => {
        const messages = await listMessagesForAgent(tauriDatabase, agent.id).catch(() => []);
        let outcomes = EMPTY_OUTCOMES;
        for (const message of messages) {
          if (message.role !== 'assistant') {
            continue;
          }
          outcomes = resolverTurnOutcomes({
            assistantText: message.content,
            previousOutcomes: outcomes,
          }).outcomes;
        }
        return [agent.id, outcomes] as const;
      }),
    );
    const hydrated = rebuilt.filter(([, outcomes]) => Object.keys(outcomes).length > 0);
    if (hydrated.length === 0) {
      return;
    }
    set((state) => {
      const next: Record<AgentId, Readonly<Record<string, ResolverThreadOutcome>>> = {
        ...state.resolverThreadOutcomes,
      };
      for (const [agentId, outcomes] of hydrated) {
        if (next[agentId] === undefined) {
          next[agentId] = outcomes;
        }
      }
      return { resolverThreadOutcomes: next };
    });
  };
};
