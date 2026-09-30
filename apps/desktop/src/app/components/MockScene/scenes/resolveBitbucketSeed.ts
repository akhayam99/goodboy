import type {
  IsoDateTime,
  MountId,
  PrComment,
  ProjectId,
  ResolveQueueItemWithThread,
  ResolveThread,
  SessionMountView,
  WorkspaceId,
} from '@goodboy/types';
import type { BitbucketPullRequest } from '../../../../features/integrations/bitbucket/client';
import { useAppStore } from '../../../../store';
import {
  NOW_ISO,
  QUEUE_ITEMS,
  SESSION_ID,
  buildItem,
  buildThread,
  isoAgo,
  msAgo,
  seedResolveScene,
} from './resolveSeed';
import { NOTES, noteRow } from './resolveGitlabSeed';

export const BITBUCKET_EXPANDED_THREAD_ID = 'bitbucket:1041';

const PR_URL = 'https://example.invalid/northwind/storefront-web/pull-requests/12';
const PR_NUMBER = 12;
const MOUNT_ID = 'mock-resolve-mount-storefront-web' as MountId;
const PROJECT_ID = 'mock-resolve-project-storefront-web' as ProjectId;
const BITBUCKET_KEY = `bitbucket:${MOUNT_ID}:${PR_NUMBER}`;
const BRANCH = 'nw/checkout-empty-cart';

const PR: BitbucketPullRequest = {
  id: PR_NUMBER,
  title: 'Keep the checkout button disabled while the cart is empty',
  description: '',
  state: 'OPEN',
  createdOn: NOW_ISO,
  updatedOn: NOW_ISO,
  sourceBranch: BRANCH,
  sourceCommit: '9b3e5d1c0f7a4e2b8c6d1a3f5e7b9c2d4a6e8f01',
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 3,
  taskCount: 0,
  webUrl: PR_URL,
};

const MOUNT_VIEW: SessionMountView = {
  id: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: '/Users/mock/northwind/storefront-web',
  lastWorktreePath: null,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'storefront-web',
  repoSlug: 'northwind/storefront-web',
  repoRoot: '/Users/mock/northwind/storefront-web',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW_ISO as IsoDateTime,
  updatedAt: NOW_ISO as IsoDateTime,
};

type BitbucketSeed = {
  readonly commentId: number;
  readonly author: string;
  readonly path: string;
  readonly line: number;
  readonly minutesAgo: number;
  readonly body: string;
};

const BITBUCKET_SEEDS: ReadonlyArray<BitbucketSeed> = [
  {
    commentId: 1041,
    author: 'sana-k',
    path: 'src/checkout/CheckoutButton.tsx',
    line: 27,
    minutesAgo: 95,
    body: 'The button stays enabled for a moment after the last item is removed. Derive disabled from the cart, not from local state.',
  },
  {
    commentId: 1042,
    author: 'joao-r',
    path: 'src/checkout/useCart.ts',
    line: 58,
    minutesAgo: 140,
    body: 'This selector returns a new array on every render. Memoize it so the button does not flicker.',
  },
  {
    commentId: 1043,
    author: 'sana-k',
    path: 'src/checkout/copy.ts',
    line: 12,
    minutesAgo: 300,
    body: "The empty cart hint says 'Nothing here'. Use the copy from the design file.",
  },
];

const threadIdOf = ({ seed }: { readonly seed: BitbucketSeed }): string =>
  `bitbucket:${seed.commentId}`;

const bitbucketComment = ({ seed }: { readonly seed: BitbucketSeed }): PrComment => ({
  id: String(seed.commentId),
  author: seed.author,
  authorAvatarUrl: null,
  body: seed.body,
  createdAt: isoAgo({ minutes: seed.minutesAgo }),
  url: `${PR_URL}#comment-${seed.commentId}`,
  source: 'review',
  path: seed.path,
  line: seed.line,
  resolved: false,
  outdated: false,
  threadId: threadIdOf({ seed }),
  canResolve: false,
});

const bitbucketRow = ({ seed }: { readonly seed: BitbucketSeed }): ResolveQueueItemWithThread => {
  const threadId = threadIdOf({ seed });
  const thread: ResolveThread = {
    ...buildThread({
      threadId,
      state: 'open',
      stage: 'new',
      revision: 0,
      activeAttemptId: null,
      disposition: null,
      replyDraft: null,
      question: null,
      createdMinutesAgo: seed.minutesAgo,
    }),
    prNumber: PR_NUMBER,
    projectId: PROJECT_ID,
    sourceKind: 'bitbucket',
    providerThreadId: String(seed.commentId),
  };
  const item = buildItem({
    id: `mock-bitbucket-item-${seed.commentId}`,
    threadId,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 0,
    createdMinutesAgo: seed.minutesAgo,
  });
  return { item, thread };
};

type Params = {
  readonly selected: 'github' | 'bitbucket' | 'local';
};

export const seedResolveBitbucketScene = ({ selected }: Params): void => {
  seedResolveScene({
    expandedThreadId: selected === 'bitbucket' ? BITBUCKET_EXPANDED_THREAD_ID : null,
  });
  const fetchedAt = new Date(msAgo({ minutes: 1 })).toISOString() as IsoDateTime;
  useAppStore.setState({
    sessionMounts: { [SESSION_ID]: [MOUNT_VIEW] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionResolveQueueItems: {
      [SESSION_ID]: [
        ...QUEUE_ITEMS,
        ...BITBUCKET_SEEDS.map((seed) => bitbucketRow({ seed })),
        ...NOTES.map((note) => noteRow({ note })),
      ],
    },
    mountBitbucketPr: {
      [MOUNT_ID]: {
        pr: PR,
        fetchedAt,
        loading: false,
        error: null,
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        revision: 1,
        host: 'bitbucket.org',
        repo: {
          workspaceId: 'mock-resolve-workspace-northwind' as WorkspaceId,
          workspaceSlug: 'northwind',
          repoSlug: 'storefront-web',
          email: 'dev@northwind.example',
        },
        repository: 'northwind/storefront-web',
        branch: BRANCH,
        prs: [PR],
        links: [],
      },
    },
    reviewSourceThreads: {
      [SESSION_ID]: {
        [PR_URL]: {
          comments: BITBUCKET_SEEDS.map((seed) => bitbucketComment({ seed })),
          fetchedAt,
          loading: false,
          error: null,
        },
      },
    },
    reviewSourceKeys: {
      [SESSION_ID]:
        selected === 'github' ? null : selected === 'bitbucket' ? BITBUCKET_KEY : 'local',
    },
    diffComments: { [SESSION_ID]: NOTES },
    refreshReviewSource: async () => undefined,
    selectReviewSource: async ({ key }) => {
      useAppStore.setState((state) => ({
        reviewSourceKeys: { ...state.reviewSourceKeys, [SESSION_ID]: key },
      }));
    },
  });
};
