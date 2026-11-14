import type {
  AskAnswer,
  AskAnswerParams,
  AskAnswerPort,
  AskAnswerResult,
} from '../../../../features/auto/askAnswerPort';
import { answerAsk, type AskRuntime } from './answerAsk';

type Params = {
  readonly runtimeOf: () => AskRuntime;
};

type InFlight = {
  readonly answer: AskAnswer;
  readonly result: Promise<AskAnswerResult>;
};

export const createAskAnswerer = ({ runtimeOf }: Params): AskAnswerPort => {
  const inFlight = new Map<string, InFlight>();
  return async ({ askId, answer }: AskAnswerParams) => {
    const running = inFlight.get(askId);
    if (running !== undefined) {
      const first = await running.result;
      return running.answer === answer ? first : 'settled';
    }
    const result = answerAsk({ runtime: runtimeOf(), askId, answer });
    inFlight.set(askId, { answer, result });
    try {
      return await result;
    } finally {
      inFlight.delete(askId);
    }
  };
};
