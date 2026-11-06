import type { AnsweredAsk } from '../../../features/permissions/askBatchOf';
import { denialNoticeOf } from './denialNoticeOf';

type LineParams = {
  readonly ask: AnsweredAsk;
};

type Params = {
  readonly held: ReadonlyArray<AnsweredAsk>;
  readonly prompt: string;
};

const answerLineOf = ({ ask }: LineParams): string => {
  if (ask.decision === 'deny') {
    return denialNoticeOf({ toolName: ask.toolName, reason: ask.reason ?? '' });
  }
  return ask.scope === 'once'
    ? `Permission for ${ask.toolName} is granted for this one call.`
    : `Permission for ${ask.toolName} is now granted.`;
};

export const withHeldAnswers = ({ held, prompt }: Params): string =>
  [...held.map((ask) => answerLineOf({ ask })), prompt].join('\n');
