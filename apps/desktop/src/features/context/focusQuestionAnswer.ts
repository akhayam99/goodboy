import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openQuestion } from '../session/openQuestion';
import { useOpenQuestions } from './components/QuestionsTab/useOpenQuestions';

type Params = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
  readonly prefill?: string;
};

export const focusQuestionAnswer = ({ sessionId, questionId, prefill = '' }: Params): void => {
  if (prefill !== '') {
    useOpenQuestions.getState().setCustomAnswer(questionId, prefill);
  }
  openQuestion({ state: useAppStore.getState(), sessionId, questionId });
};
