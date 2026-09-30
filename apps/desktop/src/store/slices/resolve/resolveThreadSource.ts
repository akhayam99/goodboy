import {
  BITBUCKET_THREAD_PREFIX,
  GITLAB_THREAD_PREFIX,
  bitbucketCommentId,
  gitlabDiscussionId,
} from '@goodboy/core';
import type { ResolveSourceKind, ResolveThread } from '@goodboy/types';

export const sourceKindOfThreadId = ({
  threadId,
}: {
  readonly threadId: string;
}): ResolveSourceKind => {
  if (threadId.startsWith(GITLAB_THREAD_PREFIX)) {
    return 'gitlab';
  }
  return threadId.startsWith(BITBUCKET_THREAD_PREFIX) ? 'bitbucket' : 'github';
};

const providerIdOfThreadId = ({ threadId }: { readonly threadId: string }): string => {
  if (threadId.startsWith(GITLAB_THREAD_PREFIX)) {
    return gitlabDiscussionId({ threadId });
  }
  return threadId.startsWith(BITBUCKET_THREAD_PREFIX) ? bitbucketCommentId({ threadId }) : threadId;
};

export const providerThreadIdOf = ({
  row,
}: {
  readonly row: Pick<ResolveThread, 'threadId' | 'providerThreadId'>;
}): string => row.providerThreadId ?? providerIdOfThreadId({ threadId: row.threadId });

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
