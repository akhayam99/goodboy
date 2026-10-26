import type { SessionExternalTask } from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { BRAND_SESSION } from '../../scenes/brand/canon';
import { SESSION_ID } from '../../scenes/resolveSeed';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type TaskParams = {
  readonly provider: SessionExternalTask['provider'];
  readonly identifier: string;
  readonly title: string;
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

export const installReviewStory = ({ store }: Params): void => {
  store.setState((current) => ({
    sessions: current.sessions.map((session) =>
      session.id === SESSION_ID ? { ...session, goal: BRAND_SESSION.title } : session,
    ),
    sessionExternalTasks: {
      ...current.sessionExternalTasks,
      [SESSION_ID]: [
        taskOf({
          provider: 'linear',
          identifier: BRAND_SESSION.issue,
          title: BRAND_SESSION.issueTitle,
        }),
        taskOf({ provider: 'sentry', identifier: 'PAYMENTS-API-4F2', title: BRAND_SESSION.sentry }),
      ],
    },
  }));
};
