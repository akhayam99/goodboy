import type { ResolveConversationSource, ResolveQueueRow } from '../buildResolveQueueRows';

export const conversationSourceOf = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): ResolveConversationSource => (row.thread.originKind === 'diff_comment' ? 'note' : 'github');
