import { answerOpenQuestions } from './answerOpenQuestions';
import { dismissOpenQuestion } from './dismissOpenQuestion';
import { loadSessionOpenQuestions } from './loadSessionOpenQuestions';
import { restoreDismissedOpenQuestion } from './restoreDismissedOpenQuestion';
import type { GetFn, SetFn } from './types';

export function createOpenQuestionsSlice(set: SetFn, get: GetFn) {
  return {
    loadSessionOpenQuestions: loadSessionOpenQuestions(set),
    answerOpenQuestions: answerOpenQuestions(get),
    dismissOpenQuestion: dismissOpenQuestion(set, get),
    restoreDismissedOpenQuestion: restoreDismissedOpenQuestion(set, get),
  };
}
