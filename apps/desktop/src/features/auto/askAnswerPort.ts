import { createPort } from './createPort';

export type AskAnswer = 'allow' | 'decline';

export type AskAnswerResult = 'allowed' | 'declined' | 'settled';

export type AskAnswerParams = {
  readonly askId: string;
  readonly answer: AskAnswer;
};

export type AskAnswerPort = (params: AskAnswerParams) => Promise<AskAnswerResult>;

const slot = createPort<AskAnswerPort>();

export const registerAskAnswerPort = slot.register;

export const currentAskAnswerPort = slot.current;
