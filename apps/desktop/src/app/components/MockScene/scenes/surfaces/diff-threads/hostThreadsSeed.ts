import type { PrComment } from '@goodboy/types';
import type { MountGithubState } from '../../../../../../store/types';
import { CTX_PAYMENTS_ID, CTX_PAYMENTS_MOUNT_ID, minutesAgo } from '../../brand/contextBase';
import { APPLY_WEBHOOK_PATH, POST_CREDIT_PATH } from '../../brand/contextDiffPatch';

type CommentParams = {
  readonly id: string;
  readonly threadId: string;
  readonly author: string;
  readonly body: string;
  readonly path: string;
  readonly line?: number;
  readonly minutes: number;
  readonly isResolved?: boolean;
  readonly isOutdated?: boolean;
  readonly inReplyToId?: string;
};

const commentOf = ({
  id,
  threadId,
  author,
  body,
  path,
  line,
  minutes,
  isResolved = false,
  isOutdated = false,
  inReplyToId,
}: CommentParams): PrComment => ({
  id,
  author,
  authorAvatarUrl: null,
  body,
  createdAt: minutesAgo(minutes),
  url: '',
  source: 'review',
  path,
  ...(line === undefined ? {} : { line }),
  resolved: isResolved,
  outdated: isOutdated,
  threadId,
  canResolve: true,
  ...(inReplyToId === undefined ? {} : { inReplyToId }),
});

export const HOST_THREAD_IDS = {
  open: 'PRRT_diff_open',
  resolved: 'PRRT_diff_resolved',
  outdated: 'PRRT_diff_outdated',
  gone: 'PRRT_diff_gone',
} as const;

export const HOST_COMMENTS: ReadonlyArray<PrComment> = [
  commentOf({
    id: 'host-open',
    threadId: HOST_THREAD_IDS.open,
    author: 'Maya Ortiz',
    body: 'Return the existing credit here instead of throwing, so a retried hook stays a 200.',
    path: APPLY_WEBHOOK_PATH,
    line: 9,
    minutes: 70,
  }),
  commentOf({
    id: 'host-open-reply',
    threadId: HOST_THREAD_IDS.open,
    author: 'Kenji Watanabe',
    body: 'Agreed, I will check the unique violation first.',
    path: APPLY_WEBHOOK_PATH,
    line: 9,
    minutes: 40,
    inReplyToId: 'host-open',
  }),
  commentOf({
    id: 'host-resolved',
    threadId: HOST_THREAD_IDS.resolved,
    author: 'Maya Ortiz',
    body: 'Nit: sort the imports.',
    path: APPLY_WEBHOOK_PATH,
    line: 4,
    minutes: 200,
    isResolved: true,
  }),
  commentOf({
    id: 'host-outdated',
    threadId: HOST_THREAD_IDS.outdated,
    author: 'Maya Ortiz',
    body: 'This branch of the guard reads the old counter.',
    path: POST_CREDIT_PATH,
    line: 7,
    minutes: 300,
    isOutdated: true,
  }),
  commentOf({
    id: 'host-gone',
    threadId: HOST_THREAD_IDS.gone,
    author: 'Maya Ortiz',
    body: 'Can this helper live next to the ledger client?',
    path: POST_CREDIT_PATH,
    line: 480,
    minutes: 120,
  }),
];

export const hostThreadsGithub = (): MountGithubState => ({
  mountId: CTX_PAYMENTS_MOUNT_ID,
  projectId: CTX_PAYMENTS_ID,
  revision: 1,
  repository: 'harborline/payments-api',
  host: null,
  branch: 'hl/fix-duplicate-credit',
  prs: [],
  links: [],
  pr: {
    number: 318,
    title: 'Stop retried webhooks posting a second credit',
    url: 'https://example.invalid/harborline/payments-api/pull/318',
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: 'hl/fix-duplicate-credit',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: minutesAgo(30),
  },
  linkedIssues: [],
  fetchedAt: minutesAgo(5),
  failedAt: null,
  loading: false,
  error: null,
  detail: { prNumber: 318, comments: HOST_COMMENTS, reviews: [], reviewRequests: [], checks: [] },
  detailFetchedAt: minutesAgo(5),
  detailLoading: false,
  detailError: null,
});
