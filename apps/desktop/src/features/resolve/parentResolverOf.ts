import type { Agent, AgentId, ResolveAttempt } from '@goodboy/types';

type Params = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly agents: ReadonlyArray<Agent>;
  readonly threadIds: ReadonlyArray<string>;
};

export const parentResolverOf = ({ attempts, agents, threadIds }: Params): AgentId | undefined => {
  const wanted = new Set(threadIds);
  const live = new Set(
    agents.filter((agent) => agent.deletedAt === undefined).map((agent) => agent.id),
  );
  return attempts
    .filter(
      (attempt) =>
        live.has(attempt.agentId) && attempt.threadIds.some((threadId) => wanted.has(threadId)),
    )
    .reduce<ResolveAttempt | null>(
      (latest, attempt) =>
        latest === null || attempt.createdAt >= latest.createdAt ? attempt : latest,
      null,
    )?.agentId;
};
