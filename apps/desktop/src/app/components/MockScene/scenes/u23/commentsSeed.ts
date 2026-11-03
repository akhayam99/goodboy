import type { PrComment, ResolveQueueItemWithThread } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  EXPANDED_THREAD_ID,
  QUEUE_ITEMS,
  RESOLVE_SCENE_PR,
  SESSION_ID,
  THREAD_IDS,
  buildItem,
  buildThread,
  isoAgo,
  seedResolveScene,
} from '../resolveSeed';
import { prPageIpc, prPageMountState } from './prPageSeed';

const UNPUSHED_COMMITS = 3;

export type CommentsVariant =
  'groups' | 'ready-to-push' | 'push-failed' | 'left-open' | 'action-bar' | 'working';

const PUSH_FAILED_THREAD_ID = 'PRRT_thread_credit_row';
const LEFT_OPEN_THREAD_ID = 'PRRT_thread_flaky_test';
const PUSH_ERROR = JSON.stringify({ error: 'rejected: the remote has newer commits' });

const PUSH_FAILED_COMMENT: PrComment = {
  id: `mock-resolve-comment-${PUSH_FAILED_THREAD_ID}`,
  author: 'dana-r',
  authorAvatarUrl: null,
  body: 'The credit row should carry the processor event id, not the delivery id.',
  createdAt: isoAgo({ minutes: 180 }),
  url: `${RESOLVE_SCENE_PR.url}#discussion_credit_row`,
  source: 'review',
  path: 'src/ledger/creditRow.ts',
  line: 31,
  resolved: false,
  outdated: false,
  threadId: PUSH_FAILED_THREAD_ID,
};

const pushFailedEntry = (): ResolveQueueItemWithThread => ({
  item: buildItem({
    id: 'mock-resolve-item-credit-row',
    threadId: PUSH_FAILED_THREAD_ID,
    approvalState: 'accepted',
    approvedRevision: 1,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 170,
  }),
  thread: {
    ...buildThread({
      threadId: PUSH_FAILED_THREAD_ID,
      state: 'failed',
      stage: 'failed',
      revision: 1,
      activeAttemptId: null,
      disposition: 'fix',
      replyDraft: 'Switched the credit row to the processor event id.',
      question: null,
      createdMinutesAgo: 170,
    }),
    stateReason: `publication_failed:${PUSH_ERROR}`,
  },
});

const ACCEPTED_IDS: ReadonlyArray<string> = [EXPANDED_THREAD_ID, THREAD_IDS.metrics];

const acceptedOf = (entry: ResolveQueueItemWithThread): ResolveQueueItemWithThread => ({
  item: { ...entry.item, approvalState: 'accepted', approvedRevision: entry.thread.revision },
  thread: { ...entry.thread, state: 'fixed', stage: 'approved', disposition: 'fix' },
});

const failedPushOf = (entry: ResolveQueueItemWithThread): ResolveQueueItemWithThread => {
  const accepted = acceptedOf(entry);
  return {
    item: accepted.item,
    thread: {
      ...accepted.thread,
      state: 'failed',
      stage: 'failed',
      stateReason: `publication_failed:${PUSH_ERROR}`,
    },
  };
};

const queueOf = ({
  variant,
}: {
  readonly variant: CommentsVariant;
}): ReadonlyArray<ResolveQueueItemWithThread> => {
  if (variant === 'groups') {
    return [...QUEUE_ITEMS, pushFailedEntry()];
  }
  if (variant === 'ready-to-push') {
    return QUEUE_ITEMS.map((entry) =>
      ACCEPTED_IDS.includes(entry.thread.threadId) ? acceptedOf(entry) : entry,
    );
  }
  if (variant === 'push-failed') {
    return QUEUE_ITEMS.map((entry) =>
      ACCEPTED_IDS.includes(entry.thread.threadId) ? failedPushOf(entry) : entry,
    );
  }
  return QUEUE_ITEMS;
};

const focusOf = ({ variant }: { readonly variant: CommentsVariant }): string => {
  switch (variant) {
    case 'left-open':
      return LEFT_OPEN_THREAD_ID;
    case 'working':
      return THREAD_IDS.idempotency;
    case 'push-failed':
      return EXPANDED_THREAD_ID;
    case 'ready-to-push':
      return THREAD_IDS.errorShape;
    case 'groups':
    case 'action-bar':
      return EXPANDED_THREAD_ID;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
};

export const seedCommentsScene = ({ variant }: { readonly variant: CommentsVariant }): void => {
  seedResolveScene({
    expandedThreadId: focusOf({ variant }),
    layeredIpc: prPageIpc({ behind: 0, unpushed: UNPUSHED_COMMITS }),
  });
  const state = useAppStore.getState();
  const seeded = state.sessionGithub[SESSION_ID];
  const github =
    variant === 'groups' && seeded?.detail != null
      ? {
          ...seeded,
          detail: { ...seeded.detail, comments: [...seeded.detail.comments, PUSH_FAILED_COMMENT] },
        }
      : seeded;
  const queue = queueOf({ variant });
  useAppStore.setState({
    ...(github === undefined ? {} : prPageMountState({ github })),
    sessionResolveQueueItems: { [SESSION_ID]: queue },
    sessionResolveThreads: { [SESSION_ID]: queue.map((entry) => entry.thread) },
    sessionBranches: { [SESSION_ID]: RESOLVE_SCENE_PR.headBranch },
    ...(github === undefined
      ? {}
      : { sessionGithub: { ...state.sessionGithub, [SESSION_ID]: github } }),
  });
};
