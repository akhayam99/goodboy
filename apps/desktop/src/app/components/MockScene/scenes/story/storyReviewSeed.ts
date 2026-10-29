import type { PrComment, SessionExternalTask, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { useAppStore } from '../../../../../store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import {
  FIX_RUN_MOUNT,
  MOUNT_TARGET,
  SESSION,
  SESSION_ID,
  THREAD_IDS,
  seedResolveScene,
} from '../resolveSeed';
import { STORY_ISSUE, STORY_REVIEW } from './storyContent';

export const STORY_REVIEW_THREAD = THREAD_IDS.retryConstant;
export const STORY_REVIEW_SESSION_ID = SESSION_ID;
export const STORY_REVIEW_MOUNT_ID = MOUNT_TARGET.mountId;

const PR_AUTHOR = { login: 'dana-r', name: 'Dana R.', avatarUrl: null };

type CommentParams = {
  readonly comment: PrComment;
};

const reworded = ({ comment }: CommentParams): PrComment => ({
  ...comment,
  body: STORY_REVIEW.comment,
  path: STORY_REVIEW.path,
  line: STORY_REVIEW.line,
});

type ViewsParams = {
  readonly views: AppStore['pullRequestViews'][SessionId];
};

const reviewViewsOf = ({ views }: ViewsParams): AppStore['pullRequestViews'][SessionId] =>
  Object.fromEntries(
    Object.entries(views).map(([key, entry]) => [
      key,
      entry.view === null
        ? entry
        : {
            ...entry,
            view: {
              ...entry.view,
              author: PR_AUTHOR,
              title: STORY_REVIEW.prTitle,
              commits: entry.view.commits.map((commit) => ({ ...commit, author: PR_AUTHOR.login })),
            },
          },
    ]),
  );

export const seedStoryReview = (): void => {
  seedResolveScene({ expandedThreadId: null });
  const at = nowIso({});
  useAppStore.setState((state) => {
    const queue = (state.sessionResolveQueueItems[SESSION_ID] ?? []).filter(
      (entry) => entry.thread.threadId === STORY_REVIEW_THREAD,
    );
    const itemIds = new Set(queue.map((entry) => entry.item.id));
    const github = state.sessionGithub[SESSION_ID];
    const task: SessionExternalTask = {
      sessionId: SESSION_ID,
      provider: 'linear',
      externalId: 'demo-story-linear-hbl-412',
      identifier: STORY_ISSUE.identifier,
      url: 'https://example.invalid/linear/HBL-412',
      title: STORY_ISSUE.title,
      createdAt: at,
    };
    return {
      sessions: state.sessions.map((session) =>
        session.id === SESSION_ID ? { ...SESSION, goal: STORY_ISSUE.title } : session,
      ),
      sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [SESSION_ID]: queue },
      sessionResolveAttempts: { ...state.sessionResolveAttempts, [SESSION_ID]: [] },
      sessionResolveCandidates: {
        ...state.sessionResolveCandidates,
        [SESSION_ID]: (state.sessionResolveCandidates[SESSION_ID] ?? []).map((entry) => ({
          ...entry,
          items: entry.items.filter((item) => itemIds.has(item.queueItemId)),
        })),
      },
      sessionResolvePublications: { ...state.sessionResolvePublications, [SESSION_ID]: [] },
      sessionResolveSourceSnapshots: { ...state.sessionResolveSourceSnapshots, [SESSION_ID]: {} },
      sessionOpenQuestions: { ...state.sessionOpenQuestions, [SESSION_ID]: [] },
      sessionExternalTasks: { ...state.sessionExternalTasks, [SESSION_ID]: [task] },
      sessionProjectMounts: {
        ...state.sessionProjectMounts,
        [SESSION_ID]: [{ ...FIX_RUN_MOUNT, baseBranch: 'main' }],
      },
      sessionGithub:
        github === undefined || github.detail === null || github.pr === null
          ? state.sessionGithub
          : {
              ...state.sessionGithub,
              [SESSION_ID]: {
                ...github,
                pr: {
                  ...github.pr,
                  author: PR_AUTHOR.login,
                  title: STORY_REVIEW.prTitle,
                },
                detail: {
                  ...github.detail,
                  comments: github.detail.comments.flatMap((comment) =>
                    comment.threadId === STORY_REVIEW_THREAD && comment.inReplyToId === undefined
                      ? [reworded({ comment })]
                      : [],
                  ),
                },
              },
            },
      pullRequestViews: {
        ...state.pullRequestViews,
        [SESSION_ID]: reviewViewsOf({ views: state.pullRequestViews[SESSION_ID] ?? {} }),
      },
      branchThreadId: { ...state.branchThreadId, [SESSION_ID]: null },
    };
  });
};

export const openStoryFixDrawer = (): void => {
  useAppStore.getState().openDrawer({
    kind: 'fix-comments',
    sessionId: SESSION_ID,
    payload: {
      mountId: MOUNT_TARGET.mountId,
      focusThreadId: STORY_REVIEW_THREAD,
      threadIds: [STORY_REVIEW_THREAD],
    },
  });
};
