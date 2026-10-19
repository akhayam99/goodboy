import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { useOpenQuestions } from '../components/QuestionsTab/useOpenQuestions';
import { useOpenAgentQuestion } from '../hooks/useOpenAgentQuestion';

type Params = {
  readonly sessionId: SessionId;
};

type QuestionOpeners = {
  readonly focusQuestion: (questionId: OpenQuestionId) => void;
  readonly openAgentQuestion: ReturnType<typeof useOpenAgentQuestion>;
};

export const useQuestionOpeners = ({ sessionId }: Params): QuestionOpeners => ({
  focusQuestion: useOpenQuestions((state) => state.focusQuestion),
  openAgentQuestion: useOpenAgentQuestion({ sessionId }),
});
