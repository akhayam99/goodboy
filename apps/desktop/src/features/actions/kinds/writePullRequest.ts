import type { PrWriteOptions } from '../../../store/slices/github/prWriteOptions';
import { refreshActiveRequest } from '../../../store/slices/review-source/refreshActiveRequest';
import type { ActionEnv } from '../types';
import type { PullRequestFacts } from './pullRequestFacts';

type WriteTaskParams = {
  readonly number: number;
  readonly options: PrWriteOptions;
};

type Params = {
  readonly env: ActionEnv;
  readonly facts: PullRequestFacts;
  readonly task: (params: WriteTaskParams) => Promise<void>;
};

type RefreshParams = Omit<Params, 'task'>;

const mountScopeOf = ({ facts }: Pick<Params, 'facts'>): PrWriteOptions =>
  facts.mountId === null ? {} : { mountId: facts.mountId };

const refresh = ({ env, facts }: RefreshParams): void => {
  const state = env.getState();
  const mountScope = mountScopeOf({ facts });
  void refreshActiveRequest({ get: env.getState, sessionId: facts.sessionId, ...mountScope });
  if (facts.host === 'github') {
    void state.refreshSessionPrDetail(facts.sessionId, { force: true, ...mountScope });
  }
  void state.loadPullRequestView({ sessionId: facts.sessionId, force: true, ...mountScope });
};

export const writePullRequest = async ({ env, facts, task }: Params): Promise<void> => {
  if (facts.number === null) {
    return;
  }
  await task({
    number: facts.number,
    options: {
      ...mountScopeOf({ facts }),
      ...(env.isOutcomeShown === true && { isFailureShown: true }),
    },
  });
  refresh({ env, facts });
};
