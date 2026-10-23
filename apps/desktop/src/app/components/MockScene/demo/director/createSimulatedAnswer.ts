import type { IsoDateTime, OpenQuestion } from '@goodboy/types';
import { wrapOpenQuestionAnswers } from '@goodboy/core';
import type { AppStore } from '../../../../../store/store';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly send: AppStore['sendTurn'];
  readonly now: () => IsoDateTime;
};

type PromptParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const promptOf = ({ questions }: PromptParams): string =>
  [
    'Answers to open questions:',
    ...questions.flatMap((question) => [
      `\n- Q: ${question.text}`,
      `  A: ${question.userAnswer ?? ''}`,
    ]),
  ].join('\n');

export const createSimulatedAnswer =
  ({ store, send, now }: Params): AppStore['answerOpenQuestions'] =>
  async (sessionId, pairs, targetAgentId) => {
    const answers = new Map(
      pairs.filter((pair) => pair.answer.trim().length > 0).map((pair) => [pair.id, pair.answer]),
    );
    const at = now();
    const answered = (store.getState().sessionOpenQuestions[sessionId] ?? []).flatMap(
      (question): ReadonlyArray<OpenQuestion> => {
        const answer = answers.get(question.id);
        if (answer === undefined || question.status !== 'open') {
          return [];
        }
        return [
          {
            ...question,
            status: 'answered',
            userAnswer: answer,
            answerSource: 'user',
            answeredAt: at,
            answerDeliveredAt: at,
          },
        ];
      },
    );
    const first = answered[0];
    if (first === undefined) {
      return;
    }
    const ids = new Set(answered.map((question) => question.id));
    store.setState((current) => ({
      sessionOpenQuestions: {
        ...current.sessionOpenQuestions,
        [sessionId]: (current.sessionOpenQuestions[sessionId] ?? []).filter(
          (question) => !ids.has(question.id),
        ),
      },
      sessionAnsweredQuestions: {
        ...current.sessionAnsweredQuestions,
        [sessionId]: [...(current.sessionAnsweredQuestions[sessionId] ?? []), ...answered],
      },
    }));
    await send({
      sessionId,
      agentId: first.createdByAgentId ?? targetAgentId ?? undefined,
      content: wrapOpenQuestionAnswers(promptOf({ questions: answered })),
    });
  };
