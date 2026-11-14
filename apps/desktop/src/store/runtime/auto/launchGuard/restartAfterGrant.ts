import { getAutoDelegation, type AutoGrant } from '@goodboy/db';
import type { AskAnswer } from '../../../../features/auto/askAnswerPort';
import type { AutoRuntime } from '../createAutoRuntime';

type Params = {
  readonly runtime: Pick<AutoRuntime, 'ctx' | 'continueChild'>;
  readonly grant: AutoGrant;
  readonly answer: AskAnswer;
};

type TextParams = {
  readonly grant: AutoGrant;
  readonly answer: AskAnswer;
};

const restartTextOf = ({ grant, answer }: TextParams): string => {
  if (grant.kind === 'dependency') {
    return answer === 'allow'
      ? `The user allowed ${grant.subject} for this attempt. Add it and finish the task.`
      : `The user did not allow ${grant.subject}. Do the task without it.`;
  }
  return answer === 'allow'
    ? `The user allowed a change to ${grant.subject} for this attempt. Make it and finish the task.`
    : `The user did not allow a change to ${grant.subject}. Do the task without changing it.`;
};

export const restartAfterGrant = async ({ runtime, grant, answer }: Params): Promise<void> => {
  if (grant.delegationId === null || grant.kind === 'pull_request') {
    return;
  }
  const delegation = await getAutoDelegation({
    db: runtime.ctx.db,
    delegationId: grant.delegationId,
  });
  if (delegation === null) {
    return;
  }
  await runtime.continueChild({
    childAgentId: delegation.childAgentId,
    text: restartTextOf({ grant, answer }),
    from: 'user',
    settleWaitMs: 0,
  });
};
