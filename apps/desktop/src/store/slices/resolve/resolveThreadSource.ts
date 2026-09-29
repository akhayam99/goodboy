import { GITLAB_THREAD_PREFIX, gitlabDiscussionId } from '@goodboy/core';
import type { ResolveSourceKind, ResolveThread } from '@goodboy/types';

export const sourceKindOfThreadId = ({
  threadId,
}: {
  readonly threadId: string;
}): ResolveSourceKind => (threadId.startsWith(GITLAB_THREAD_PREFIX) ? 'gitlab' : 'github');

export const providerThreadIdOf = ({
  row,
}: {
  readonly row: Pick<ResolveThread, 'threadId' | 'providerThreadId'>;
}): string =>
  row.providerThreadId ??
  (row.threadId.startsWith(GITLAB_THREAD_PREFIX)
    ? gitlabDiscussionId({ threadId: row.threadId })
    : row.threadId);

export const threadSourceKindOf = ({
  row,
}: {
  readonly row: Pick<ResolveThread, 'threadId' | 'originKind' | 'sourceKind'>;
}): ResolveSourceKind => {
  if (row.originKind === 'diff_comment') {
    return 'local';
  }
  return row.sourceKind ?? sourceKindOfThreadId({ threadId: row.threadId });
};
