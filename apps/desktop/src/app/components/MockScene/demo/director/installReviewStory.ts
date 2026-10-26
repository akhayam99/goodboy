import type { ResolveQueueItemWithThread, SessionExternalTask } from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { AppStore } from '../../../../../store/store';
import { BRAND_SESSION } from '../../scenes/brand/canon';
import { SESSION_ID } from '../../scenes/resolveSeed';
import type { DirectorStore } from './directorTypes';
import { STORY_COMMENTS, STORY_THREAD_IDS } from './resolveStory';

type Params = {
  readonly store: DirectorStore;
};

type TaskParams = {
  readonly provider: SessionExternalTask['provider'];
  readonly identifier: string;
  readonly title: string;
};

type StateParams = {
  readonly state: AppStore;
};

const taskOf = ({ provider, identifier, title }: TaskParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider,
  externalId: `demo-review-${identifier}`,
  identifier,
  url: `https://example.invalid/${provider}/${identifier}`,
  title,
  createdAt: nowIso({}),
});

const FIXED_THREAD_IDS: ReadonlyArray<string> = [
  STORY_THREAD_IDS.idempotency,
  STORY_THREAD_IDS.logging,
];

const STORY_IDS: ReadonlySet<string> = new Set(Object.values(STORY_THREAD_IDS));

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
};

const isStoryThread = ({ entry }: EntryParams): boolean => STORY_IDS.has(entry.thread.threadId);

const storyQueueOf = ({ state }: StateParams): ReadonlyArray<ResolveQueueItemWithThread> =>
  (state.sessionResolveQueueItems[SESSION_ID] ?? []).filter((entry) => isStoryThread({ entry }));

const storyItemIdsOf = ({ state }: StateParams): ReadonlySet<string> =>
  new Set(
    storyQueueOf({ state })
      .filter((entry) => FIXED_THREAD_IDS.includes(entry.thread.threadId))
      .map((entry) => entry.item.id),
  );

const patchedGithubOf = ({ state }: StateParams): AppStore['sessionGithub'] => {
  const github = state.sessionGithub[SESSION_ID];
  if (github === undefined || github.detail === null) {
    return state.sessionGithub;
  }
  const comments = github.detail.comments.flatMap((comment) => {
    const copy = comment.threadId === undefined ? undefined : STORY_COMMENTS[comment.threadId];
    return copy === undefined || comment.inReplyToId !== undefined
      ? []
      : [{ ...comment, body: copy.body, path: copy.path, line: copy.line }];
  });
  return {
    ...state.sessionGithub,
    [SESSION_ID]: { ...github, detail: { ...github.detail, comments } },
  };
};

export const installReviewStory = ({ store }: Params): void => {
  store.setState((current) => {
    const itemIds = storyItemIdsOf({ state: current });
    const covered = FIXED_THREAD_IDS;
    return {
      sessions: current.sessions.map((session) =>
        session.id === SESSION_ID ? { ...session, goal: BRAND_SESSION.title } : session,
      ),
      sessionResolveQueueItems: {
        ...current.sessionResolveQueueItems,
        [SESSION_ID]: storyQueueOf({ state: current }),
      },
      sessionResolveAttempts: {
        ...current.sessionResolveAttempts,
        [SESSION_ID]: (current.sessionResolveAttempts[SESSION_ID] ?? []).map((attempt) => ({
          ...attempt,
          threadIds: covered,
        })),
      },
      sessionResolveCandidates: {
        ...current.sessionResolveCandidates,
        [SESSION_ID]: (current.sessionResolveCandidates[SESSION_ID] ?? []).map((entry) => ({
          ...entry,
          items: entry.items.filter((item) => itemIds.has(item.queueItemId)),
        })),
      },
      sessionGithub: patchedGithubOf({ state: current }),
      sessionExternalTasks: {
        ...current.sessionExternalTasks,
        [SESSION_ID]: [
          taskOf({
            provider: 'linear',
            identifier: BRAND_SESSION.issue,
            title: BRAND_SESSION.issueTitle,
          }),
          taskOf({
            provider: 'sentry',
            identifier: 'PAYMENTS-API-4F2',
            title: BRAND_SESSION.sentry,
          }),
        ],
      },
    };
  });
};
