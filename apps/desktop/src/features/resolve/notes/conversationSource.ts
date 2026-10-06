import type { ResolveThread } from '@goodboy/types';
import type { ResolveConversationSource } from '../buildResolveQueueRows';

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
