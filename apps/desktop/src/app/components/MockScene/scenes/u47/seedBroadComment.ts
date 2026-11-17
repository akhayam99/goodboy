import { useAppStore } from '../../../../../store';
import { SESSION_ID, THREAD_IDS } from '../resolveSeed';

export const BROAD_THREAD_ID = THREAD_IDS.retryConstant;

const BROAD_COMMENT_BODY =
  'This retry loop should not live in the handler. Follow the payouts route as the model: a RetryScheduler owns the backoff and the handler only enqueues. Write new components for this and leave LegacyRetryQueue as it is.';

export const seedBroadComment = (): void => {
  const github = useAppStore.getState().sessionGithub[SESSION_ID];
  const detail = github?.detail ?? null;
  if (github === undefined || detail === null) {
    return;
  }
  useAppStore.setState({
    sessionGithub: {
      ...useAppStore.getState().sessionGithub,
      [SESSION_ID]: {
        ...github,
        detail: {
          ...detail,
          comments: detail.comments.map((comment) =>
            comment.threadId === BROAD_THREAD_ID
              ? { ...comment, body: BROAD_COMMENT_BODY }
              : comment,
          ),
        },
      },
    },
  });
};
