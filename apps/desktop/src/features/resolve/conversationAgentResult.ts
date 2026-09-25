import type { WorkNodeState } from '@goodboy/ui';
import type { ResolveQueueRow } from './buildResolveQueueRows';

export type ConversationCommitLink = {
  readonly label: 'fixup of' | 'replaces';
  readonly sha: string;
};

export type ConversationAgentResult = {
  readonly node: WorkNodeState;
  readonly lead: string;
  readonly sha: string | null;
  readonly link?: ConversationCommitLink;
  readonly isPushed: boolean;
};

const commitLinkOf = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): ConversationCommitLink | undefined => {
  if (row.thread.fixupOfSha !== null) {
    return { label: 'fixup of', sha: row.thread.fixupOfSha };
  }
  if (row.thread.replacesSha !== null) {
    return { label: 'replaces', sha: row.thread.replacesSha };
  }
  return undefined;
};

export const conversationSha = ({ row }: { readonly row: ResolveQueueRow }): string | null =>
  row.item.integratedSha ?? row.thread.commitShas?.at(-1) ?? null;

export const hasConversationAgent = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.attempt !== null || conversationSha({ row }) !== null;

export const conversationAgentResult = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): ConversationAgentResult => {
  const sha = conversationSha({ row });
  const isPushed = row.status === 'resolved' || row.rowState.failedStep === 'reply';
  if (row.status === 'working') {
    return { node: 'running', lead: 'Working on it', sha: null, isPushed: false };
  }
  if (row.status === 'needs_you') {
    return {
      node: 'question',
      lead: row.thread.question ?? 'Asked you a question',
      sha: null,
      isPushed,
    };
  }
  if (row.status === 'failed' && row.rowState.failedStep === 'run') {
    return { node: 'failed', lead: 'The run stopped on an error', sha: null, isPushed: false };
  }
  if (sha !== null) {
    const link = commitLinkOf({ row });
    return { node: 'done', lead: 'Fixed in', sha, ...(link !== undefined && { link }), isPushed };
  }
  if (row.proposalKind === 'reply_only') {
    return { node: 'done', lead: 'Reply only', sha: null, isPushed };
  }
  return { node: 'done', lead: 'No change', sha: null, isPushed };
};
