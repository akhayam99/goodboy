import type { AgentId, HandoffSender, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { HandoffNames } from '../../../utils/handoffLabels';

type Params = {
  readonly sessionId: SessionId | null;
  readonly sender: HandoffSender | null;
};

type AgentIdParams = {
  readonly sender: HandoffSender | null;
};

const namedAgentId = ({ sender }: AgentIdParams): AgentId | null => {
  if (sender?.kind === 'parent') {
    return sender.parentAgentId;
  }
  if (sender?.kind === 'followUp') {
    return sender.sourceAgentId;
  }
  return null;
};

export const useHandoffNames = ({ sessionId, sender }: Params): HandoffNames => {
  const agentId = namedAgentId({ sender });
  const questionId = sender?.kind === 'question' ? sender.questionId : null;
  const agentName = useAppStore((state) =>
    sessionId === null || agentId === null
      ? null
      : ((state.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === agentId)?.name ??
        null),
  );
  const questionText = useAppStore((state) => {
    if (sessionId === null || questionId === null) {
      return null;
    }
    const questions = [
      ...(state.sessionOpenQuestions[sessionId] ?? []),
      ...(state.sessionAnsweredQuestions[sessionId] ?? []),
    ];
    return questions.find((question) => question.id === questionId)?.text ?? null;
  });
  return { agentName, questionText };
};
