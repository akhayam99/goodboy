import type { PullRequestPort } from '@goodboy/core/review-source';
import { selectActiveMountId } from '../../../store/slices/project-mounts/selectors';
import { pullRequestPortFor } from '../../../store/slices/review-source/pullRequestPortFor';
import { refreshActiveRequest } from '../../../store/slices/review-source/refreshActiveRequest';
import type { ActionEnv } from '../types';
import type { PullRequestFacts } from './pullRequestFacts';

type WriteParams = {
  readonly port: PullRequestPort;
};

type Params = {
  readonly facts: PullRequestFacts;
  readonly env: ActionEnv;
  readonly unsupported: string;
  readonly write: (params: WriteParams) => Promise<void> | null;
};

export const writeAutoMerge = async ({ facts, env, unsupported, write }: Params): Promise<void> => {
  if (facts.number === null) {
    return;
  }
  const mountId =
    facts.mountId ?? selectActiveMountId({ state: env.getState(), sessionId: facts.sessionId });
  const target = { sessionId: facts.sessionId, ...(mountId === null ? {} : { mountId }) };
  const port = pullRequestPortFor({ get: env.getState, ...target, prNumber: facts.number });
  const written = port === null ? null : write({ port });
  if (written === null) {
    throw new Error(unsupported);
  }
  await written;
  await Promise.all([
    refreshActiveRequest({ get: env.getState, ...target }),
    env.getState().loadPullRequestView({ ...target, force: true }),
  ]);
};
