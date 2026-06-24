import type { Agent, AgentId } from '@goodboy/types';
import { resolverStatus, type ResolverStatus } from '../workspace/components/WorkspacesSidebar/lib';

export { resolverStatus };
export type { ResolverStatus };

export type ResolverLink = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
};

export type ResolverIndex = {
  readonly byThreadId: Map<string, ResolverLink>;
  readonly byCommentUrl: Map<string, ResolverLink>;
  readonly byDiffAgentId: Map<AgentId, ResolverLink>;
};

export const buildResolverIndex = (
  resolvers: ReadonlyArray<Agent>,
  args: {
    resolvedThreadIds: ReadonlySet<string>;
    pendingThreadIds: ReadonlySet<string>;
    statusOf: (agent: Agent) => ResolverStatus;
  },
): ResolverIndex => {
  const byThreadId = new Map<string, ResolverLink>();
  const byCommentUrl = new Map<string, ResolverLink>();
  const byDiffAgentId = new Map<AgentId, ResolverLink>();
  for (const agent of resolvers) {
    const link: ResolverLink = { agent, status: args.statusOf(agent) };
    if (agent.sourceThreadId != null) {
      if (!byThreadId.has(agent.sourceThreadId)) {
        byThreadId.set(agent.sourceThreadId, link);
      }
      continue;
    }
    if (agent.sourceCommentUrl != null) {
      if (!byCommentUrl.has(agent.sourceCommentUrl)) {
        byCommentUrl.set(agent.sourceCommentUrl, link);
      }
      continue;
    }
    byDiffAgentId.set(agent.id, link);
  }
  return { byThreadId, byCommentUrl, byDiffAgentId };
};

export const resolverForComment = (
  index: ResolverIndex,
  ref: { threadId?: string; url?: string },
): ResolverLink | undefined => {
  if (ref.threadId != null) {
    const byThread = index.byThreadId.get(ref.threadId);
    if (byThread) {
      return byThread;
    }
  }
  if (ref.url != null) {
    return index.byCommentUrl.get(ref.url);
  }
  return undefined;
};
