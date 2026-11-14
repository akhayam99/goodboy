import { pullRequestOfResult, type ResultPullRequest } from '@goodboy/core/auto';
import { getAutoDelegation, type AutoDelegation, type AutoGrant } from '@goodboy/db';
import type { AskAnswer, AskAnswerResult } from '../../../../features/auto/askAnswerPort';
import type { AgentVerbContext } from '../verbContext';
import { answerGrant } from './answerGrant';
import { bumpTreeStatement } from './bumpTreeStatement';
import { isStatementsWritten } from './isStatementsWritten';
import { openOrHoldPullRequest } from './openOrHoldPullRequest';
import { pullRequestRecordStatement } from './pullRequestRecordStatement';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly grant: AutoGrant;
  readonly answer: AskAnswer;
};

type HeldParams = {
  readonly ctx: AgentVerbContext;
  readonly grant: AutoGrant;
};

type Held = Readonly<{ delegation: AutoDelegation; record: ResultPullRequest }>;

const heldOf = async ({ ctx, grant }: HeldParams): Promise<Held | null> => {
  if (grant.delegationId === null) {
    return null;
  }
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId: grant.delegationId });
  const record = delegation === null ? null : pullRequestOfResult({ result: delegation.result });
  if (
    delegation === null ||
    record === null ||
    delegation.state !== 'settled' ||
    record.grantId !== grant.id ||
    record.textVersion !== grant.textVersion
  ) {
    return null;
  }
  return { delegation, record };
};

const OPEN_AGAIN_STATES: ReadonlySet<ResultPullRequest['state']> = new Set([
  'failed',
  'opening',
  'declined',
  'awaiting_push',
]);

type OpenParams = Held & {
  readonly ctx: AgentVerbContext;
};

const opened = async ({ ctx, delegation, record }: OpenParams): Promise<AskAnswerResult> =>
  (await openOrHoldPullRequest({ ctx, delegation, record })) ? 'allowed' : 'settled';

export const answerPullRequest = async ({
  ctx,
  grant,
  answer,
}: Params): Promise<AskAnswerResult> => {
  const held = await heldOf({ ctx, grant });
  if (held === null || !grant.isCurrent) {
    return 'settled';
  }
  if (grant.state !== 'asked') {
    const canOpenAgain =
      answer === 'allow' &&
      (grant.state === 'allowed' || grant.state === 'declined') &&
      OPEN_AGAIN_STATES.has(held.record.state);
    return canOpenAgain ? opened({ ctx, ...held }) : 'settled';
  }
  const answered = await answerGrant({ ctx, grantId: grant.id, answer });
  if (answered.result === 'settled') {
    return 'settled';
  }
  if (answered.result === 'declined') {
    await isStatementsWritten({
      ctx,
      statements: [
        pullRequestRecordStatement({
          delegation: held.delegation,
          record: { ...held.record, state: 'declined' },
          fromState: 'awaiting_confirm',
        }),
        bumpTreeStatement({ delegation: held.delegation, nowMs: ctx.now() }),
      ],
    });
    return 'declined';
  }
  return opened({ ctx, ...held });
};
