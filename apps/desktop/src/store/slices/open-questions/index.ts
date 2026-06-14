import { answerOpenQuestions } from './answerOpenQuestions';
import { clearOpenQuestionScroll } from './clearOpenQuestionScroll';
import { dismissOpenQuestion } from './dismissOpenQuestion';
import { loadSessionAnsweredQuestions } from './loadSessionAnsweredQuestions';
import { loadSessionOpenQuestions } from './loadSessionOpenQuestions';
import { requestOpenQuestionScroll } from './requestOpenQuestionScroll';
import { restoreDismissedOpenQuestion } from './restoreDismissedOpenQuestion';
import type { GetFn, SetFn } from './types';

export const createOpenQuestionsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionOpenQuestions: loadSessionOpenQuestions(set),
    loadSessionAnsweredQuestions: loadSessionAnsweredQuestions(set),
    requestOpenQuestionScroll: requestOpenQuestionScroll(set),
    clearOpenQuestionScroll: clearOpenQuestionScroll(set),
    answerOpenQuestions: answerOpenQuestions(get),
    dismissOpenQuestion: dismissOpenQuestion(set, get),
    restoreDismissedOpenQuestion: restoreDismissedOpenQuestion(set, get),
  };
};
