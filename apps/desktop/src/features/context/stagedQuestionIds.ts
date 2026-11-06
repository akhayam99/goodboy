import type { OpenQuestionId } from '@goodboy/types';
import { useOpenQuestions } from './components/QuestionsTab/useOpenQuestions';

export const stagedQuestionIds = (): ReadonlyArray<OpenQuestionId> =>
  useOpenQuestions.getState().staged;
