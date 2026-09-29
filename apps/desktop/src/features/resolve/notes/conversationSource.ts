import type { ResolveThread } from '@goodboy/types';
import type { ResolveConversationSource, ResolveQueueRow } from '../buildResolveQueueRows';

export const conversationSourceOfThread = ({
  thread,
}: {
  readonly thread: Pick<ResolveThread, 'originKind' | 'sourceKind'>;
}): ResolveConversationSource => {
  if (thread.originKind === 'diff_comment') {
    return 'note';
  }
  const kind = thread.sourceKind ?? 'github';
  return kind === 'local' ? 'note' : kind;
};

export const conversationSourceOf = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): ResolveConversationSource => conversationSourceOfThread({ thread: row.thread });
