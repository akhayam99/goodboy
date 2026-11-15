import type { ResultPublish, ResultPullRequest } from '@goodboy/core/auto';
import {
  listAutoAttemptsOfDelegation,
  patchAutoAttemptPublishStatement,
  patchAutoDelegationPublishStatement,
  type AutoDelegation,
  type GuardedStatement,
} from '@goodboy/db';
import type { AgentVerbContext } from '../verbContext';
import { pullRequestRecordStatement } from './pullRequestRecordStatement';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
  readonly message: string;
  readonly raise: ResultPublish | null;
};

export const heldForPushStatements = async ({
  ctx,
  delegation,
  record,
  message,
  raise,
}: Params): Promise<ReadonlyArray<GuardedStatement>> => {
  const held = pullRequestRecordStatement({
    delegation,
    record: { ...record, state: 'awaiting_push', message, startedAt: null },
    fromState: record.state,
  });
  if (raise === null) {
    return [held];
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  const latest = attempts.filter((attempt) => attempt.state === 'ended').at(-1);
  return [
    held,
    patchAutoDelegationPublishStatement({
      delegationId: delegation.id,
      generation: delegation.generation,
      publish: raise,
      abortCode: 'pull_request_push_delegation',
    }),
    ...(latest === undefined
      ? []
      : [
          patchAutoAttemptPublishStatement({
            attemptId: latest.id,
            generation: latest.generation,
            publish: raise,
            abortCode: 'pull_request_push_attempt',
          }),
        ]),
  ];
};
