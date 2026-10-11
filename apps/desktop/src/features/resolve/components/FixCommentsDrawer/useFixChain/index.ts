import { useMemo } from 'react';
import type { Agent, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { FIX_COMMENTS_AGENT_PREFIX, FIX_COMMENTS_LABEL } from '../fixCommentsCopy';

type Step = {
  readonly name: string;
  readonly agent: Agent;
  readonly isRunning: boolean;
};

const NO_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const NO_AGENTS: ReadonlyArray<Agent> = [];

export const useFixChain = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ReadonlyArray<Step> => {
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? NO_ATTEMPTS);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  return useMemo(
    () =>
      agents
        .filter(
          (agent) =>
            agent.deletedAt === undefined && agent.name.startsWith(FIX_COMMENTS_AGENT_PREFIX),
        )
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((agent) => {
          const mode = attempts.filter((attempt) => attempt.agentId === agent.id).at(-1)
            ?.launchChoice?.mode;
          return {
            name: mode === 'propose' ? FIX_COMMENTS_LABEL.analyzeStep : FIX_COMMENTS_LABEL.fixStep,
            agent,
            isRunning: agent.status === 'running' && agent.doneAt == null,
          };
        }),
    [agents, attempts],
  );
};
