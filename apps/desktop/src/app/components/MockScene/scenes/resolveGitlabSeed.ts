import type {
  DiffComment,
  IsoDateTime,
  PrComment,
  ResolveQueueItemWithThread,
  ResolveThread,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../../features/integrations/gitlab/client';
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

export const GITLAB_EXPANDED_THREAD_ID = 'gitlab:d41';

const MR_URL = 'https://example.invalid/harborline/notify-relay/-/merge_requests/57';
const MR_NUMBER = 57;
const GITLAB_KEY = 'gitlab:session:57';

const MR: GitlabMergeRequest = {
  id: 5701,
  iid: MR_NUMBER,
  projectId: 57,
  title: 'Retry the send when the provider returns a 503',
  description: null,
  state: 'opened',
  webUrl: MR_URL,
  sourceBranch: 'hl/relay-retry-503',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: NOW_ISO,
};

type GitlabSeed = {
  readonly discussionId: string;
  readonly author: string;
  readonly path: string;
  readonly line: number;
  readonly minutesAgo: number;
  readonly body: string;
};

const GITLAB_SEEDS: ReadonlyArray<GitlabSeed> = [
  {
    discussionId: 'd41',
    author: 'theo-v',
    path: 'src/relay/dispatch.ts',
    line: 64,
    minutesAgo: 120,
    body: 'Retry the send when the provider returns a 503, not only on timeouts.',
  },
  {
    discussionId: 'd42',
    author: 'ines-o',
    path: 'src/relay/templates.ts',
    line: 21,
    minutesAgo: 180,
    body: "The fallback subject line still says 'Untitled'. Use the template name instead.",
  },
  {
    discussionId: 'd43',
    author: 'mara-q',
    path: 'src/relay/backoff.ts',
    line: 9,
    minutesAgo: 360,
    body: 'Why 2 ** attempt and not a small table? A table is easier to read and to change.',
  },
];

const gitlabComment = ({ seed }: { readonly seed: GitlabSeed }): PrComment => ({
  id: `mock-gitlab-note-${seed.discussionId}`,
  author: seed.author,
  authorAvatarUrl: null,
  body: seed.body,
  createdAt: isoAgo({ minutes: seed.minutesAgo }),
  url: `${MR_URL}#note_${seed.discussionId}`,
  source: 'review',
  path: seed.path,
  line: seed.line,
  resolved: false,
  outdated: false,
  threadId: `gitlab:${seed.discussionId}`,
  canResolve: true,
});

const gitlabRow = ({ seed }: { readonly seed: GitlabSeed }): ResolveQueueItemWithThread => {
  const threadId = `gitlab:${seed.discussionId}`;
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
    prNumber: MR_NUMBER,
    projectId: null,
    sourceKind: 'gitlab',
    providerThreadId: seed.discussionId,
  };
  const item = buildItem({
    id: `mock-gitlab-item-${seed.discussionId}`,
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

type NoteSeed = {
  readonly id: string;
  readonly path: string;
  readonly line: number;
  readonly body: string;
};

const NOTE_SEEDS: ReadonlyArray<NoteSeed> = [
  {
    id: 'mock-note-replay',
    path: 'src/webhooks/retryPolicy.ts',
    line: 88,
    body: 'Check that the cap also applies to manual replays from the dashboard.',
  },
  {
    id: 'mock-note-timing',
    path: 'src/webhooks/config.ts',
    line: 14,
    body: 'Move RETRY_CAP_MS next to the other timing constants.',
  },
];

export const NOTES: ReadonlyArray<DiffComment> = NOTE_SEEDS.map((seed) => ({
  id: seed.id,
  sessionId: SESSION_ID,
  filePath: seed.path,
  body: seed.body,
  status: 'open',
  createdAt: isoAgo({ minutes: 1440 }) as IsoDateTime,
  anchor: { side: 'new', lineNumber: seed.line },
  authorKind: 'user',
}));

export const noteRow = ({ note }: { readonly note: DiffComment }): ResolveQueueItemWithThread => {
  const threadId = `note:${note.id}`;
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
      createdMinutesAgo: 1440,
    }),
    prNumber: null,
    originKind: 'diff_comment',
    diffCommentId: note.id,
    sourceKind: 'local',
    providerThreadId: null,
  };
  const item = buildItem({
    id: `mock-note-item-${note.id}`,
    threadId,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 0,
    createdMinutesAgo: 1440,
  });
  return { item, thread };
};

type Params = {
  readonly selected: 'github' | 'gitlab' | 'local';
};

export const seedResolveGitlabScene = ({ selected }: Params): void => {
  seedResolveScene({ expandedThreadId: selected === 'gitlab' ? GITLAB_EXPANDED_THREAD_ID : null });
  const fetchedAt = new Date(msAgo({ minutes: 1 })).toISOString() as IsoDateTime;
  useAppStore.setState({
    sessionResolveQueueItems: {
      [SESSION_ID]: [
        ...QUEUE_ITEMS,
        ...GITLAB_SEEDS.map((seed) => gitlabRow({ seed })),
        ...NOTES.map((note) => noteRow({ note })),
      ],
    },
    sessionGitlabMr: {
      [SESSION_ID]: { mr: MR, fetchedAt, loading: false, error: null },
    },
    reviewSourceThreads: {
      [SESSION_ID]: {
        [MR_URL]: {
          comments: GITLAB_SEEDS.map((seed) => gitlabComment({ seed })),
          fetchedAt,
          loading: false,
          error: null,
        },
      },
    },
    reviewSourceKeys: {
      [SESSION_ID]: selected === 'github' ? null : selected === 'gitlab' ? GITLAB_KEY : 'local',
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
