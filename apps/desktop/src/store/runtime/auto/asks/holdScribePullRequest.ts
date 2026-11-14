import { pullRequestTextVersionOf, type ResultPullRequest } from '@goodboy/core/auto';
import type { ExtractedScribeText } from '@goodboy/core/context';
import {
  insertAutoGrantStatement,
  type AutoAttempt,
  type AutoDelegation,
  type AutoGrantId,
} from '@goodboy/db';
import { brandId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';

const NOT_SAVED = 'The pull request ask could not be saved, so nothing was published.';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly mountId: string;
  readonly output: ExtractedScribeText;
};

export type HeldScribePullRequest =
  | Readonly<{ kind: 'held'; pullRequest: ResultPullRequest }>
  | Readonly<{ kind: 'failed'; message: string }>;

export const holdScribePullRequest = async ({
  ctx,
  delegation,
  attempt,
  mountId,
  output,
}: Params): Promise<HeldScribePullRequest> => {
  const title = output.prTitle;
  const body = output.prBody;
  const textVersion = pullRequestTextVersionOf({ attemptId: attempt.id, title, body });
  const grantId = brandId<AutoGrantId>({ value: `grant-pr-${attempt.id}` });
  const isSaved = await ctx.db
    .transaction({
      statements: [
        insertAutoGrantStatement({
          grant: {
            id: grantId,
            treeId: delegation.treeId,
            delegationId: delegation.id,
            attemptId: null,
            textVersion,
            kind: 'pull_request',
            subject: mountId,
            nowMs: ctx.now(),
          },
        }),
      ],
    })
    .then((outcome) => outcome.status === 'committed')
    .catch((): boolean => false);
  if (!isSaved) {
    return { kind: 'failed', message: NOT_SAVED };
  }
  return {
    kind: 'held',
    pullRequest: {
      state: 'awaiting_confirm',
      mountId,
      grantId,
      textVersion,
      title,
      body,
      number: null,
      url: null,
      message: null,
      startedAt: null,
    },
  };
};
