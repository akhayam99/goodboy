import type { SessionId } from '@goodboy/types';
import { useOpenAgentQuestion } from '../../context/hooks/useOpenAgentQuestion';

type Params = {
  readonly sessionId: SessionId;
};

export const useAnswerQuestion = ({ sessionId }: Params) => useOpenAgentQuestion({ sessionId });
