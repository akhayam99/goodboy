import type { OpenQuestionId } from '@goodboy/types';
import { useOpenQuestions } from './components/QuestionsTab/useOpenQuestions';

type Params = {
  readonly questionId: OpenQuestionId;
  readonly prefill?: string;
};

export const focusQuestionAnswer = ({ questionId, prefill = '' }: Params): void => {
  const questions = useOpenQuestions.getState();
  if (prefill !== '') {
    questions.setCustomAnswer(questionId, prefill);
  }
  questions.focusQuestion(questionId);
};
