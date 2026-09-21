import { answerOpenQuestions } from './answerOpenQuestions';
import { clearOpenQuestionScroll } from './clearOpenQuestionScroll';
import { dismissOpenQuestion } from './dismissOpenQuestion';
import { loadSessionAnsweredQuestions } from './loadSessionAnsweredQuestions';
import { loadSessionDismissedQuestions } from './loadSessionDismissedQuestions';
import { loadSessionOpenQuestions } from './loadSessionOpenQuestions';
import { requestOpenQuestionScroll } from './requestOpenQuestionScroll';
import { resolveQuestionDelegate } from './resolveQuestionDelegate';
import { restoreDismissedOpenQuestion } from './restoreDismissedOpenQuestion';
import { spawnQuestionDelegates } from './spawnQuestionDelegates';
import type { GetFn, SetFn } from './types';

export const createOpenQuestionsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionOpenQuestions: loadSessionOpenQuestions(set),
    loadSessionAnsweredQuestions: loadSessionAnsweredQuestions(set),
    loadSessionDismissedQuestions: loadSessionDismissedQuestions(set),
    requestOpenQuestionScroll: requestOpenQuestionScroll(set),
    clearOpenQuestionScroll: clearOpenQuestionScroll(set),
    answerOpenQuestions: answerOpenQuestions(set, get),
    dismissOpenQuestion: dismissOpenQuestion(set, get),
    restoreDismissedOpenQuestion: restoreDismissedOpenQuestion(set, get),
    spawnQuestionDelegates: spawnQuestionDelegates(get),
    resolveQuestionDelegate: resolveQuestionDelegate(set, get),
  };
};
