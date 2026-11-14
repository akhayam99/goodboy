import { publishOfResult } from '@goodboy/core/auto';
import { getAutoDelegation, getAutoGrant } from '@goodboy/db';
import type { AutoDelegationId } from '@goodboy/types';
import type { AskAnswer, AskAnswerResult } from '../../../../features/auto/askAnswerPort';
import type { AutoRuntime } from '../createAutoRuntime';
import { answerGrant } from './answerGrant';
import { answerPullRequest } from './answerPullRequest';
import { parseLeadAskId } from './parseLeadAskId';

export type AskRuntime = Pick<AutoRuntime, 'ctx' | 'confirm' | 'publish' | 'drive'>;

type Params = {
  readonly runtime: AskRuntime;
  readonly askId: string;
  readonly answer: AskAnswer;
};

type PushParams = {
  readonly runtime: AskRuntime;
  readonly delegationId: AutoDelegationId;
  readonly sha: string;
  readonly answer: AskAnswer;
};

const answerPush = async ({
  runtime,
  delegationId,
  sha,
  answer,
}: PushParams): Promise<AskAnswerResult> => {
  const delegation = await getAutoDelegation({ db: runtime.ctx.db, delegationId });
  const publish = delegation === null ? null : publishOfResult({ result: delegation.result });
  if (publish?.state !== 'awaiting_confirm' || (publish.sha ?? '') !== sha) {
    return 'settled';
  }
  const done = await runtime.publish({
    act: answer === 'allow' ? 'confirm' : 'decline',
    delegationIds: [delegationId],
  });
  const row = done.rows.find((entry) => entry.delegationId === delegationId);
  if (row === undefined || row.state === 'refused') {
    return 'settled';
  }
  return answer === 'allow' ? 'allowed' : 'declined';
};

export const answerAsk = async ({ runtime, askId, answer }: Params): Promise<AskAnswerResult> => {
  const ref = parseLeadAskId({ askId });
  if (ref === null) {
    return 'settled';
  }
  if (ref.kind === 'start') {
    const outcome = await runtime.confirm({
      delegationId: ref.delegationId,
      decision: answer === 'allow' ? 'confirm' : 'decline',
    });
    if (outcome === 'lost') {
      return 'settled';
    }
    return outcome === 'confirmed' ? 'allowed' : 'declined';
  }
  if (ref.kind === 'push') {
    return answerPush({ runtime, delegationId: ref.delegationId, sha: ref.sha, answer });
  }
  const grant = await getAutoGrant({ db: runtime.ctx.db, grantId: ref.grantId });
  if (grant?.kind === 'pull_request') {
    return answerPullRequest({ ctx: runtime.ctx, grant, answer });
  }
  const outcome = await answerGrant({ ctx: runtime.ctx, grantId: ref.grantId, answer });
  if (outcome.treeId !== null) {
    await runtime.drive(outcome.treeId);
  }
  return outcome.result;
};
