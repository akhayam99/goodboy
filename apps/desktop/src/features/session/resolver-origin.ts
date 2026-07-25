import type { Agent, AgentSourceKind } from '@goodboy/types';

export type ResolverOrigin = {
  readonly kind: AgentSourceKind | 'unknown';
  readonly label: string;
  readonly isRecorded: boolean;
};

type Params = {
  readonly agent: Agent;
  readonly hasDiffComment: boolean;
};

const LABEL: Record<AgentSourceKind | 'unknown', string> = {
  review_comment: 'Review comment',
  issue_comment: 'Conversation comment',
  diff_comment: 'Inline diff note',
  unknown: 'Unknown origin',
};

const inferKind = ({ agent }: { readonly agent: Agent }): AgentSourceKind | 'unknown' => {
  if (agent.sourceThreadId != null) {
    return 'review_comment';
  }
  if (agent.sourceCommentUrl != null) {
    return 'issue_comment';
  }
  return 'unknown';
};

export const resolverOrigin = ({ agent, hasDiffComment }: Params): ResolverOrigin => {
  if (agent.sourceKind !== undefined) {
    return { kind: agent.sourceKind, label: LABEL[agent.sourceKind], isRecorded: true };
  }
  const inferred = hasDiffComment ? 'diff_comment' : inferKind({ agent });
  return { kind: inferred, label: LABEL[inferred], isRecorded: false };
};
