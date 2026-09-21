import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AnsweredCard } from './AnsweredCard';
import { InteractiveQuestionCard } from './InteractiveQuestionCard';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
  readonly askedByName?: string | null;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const OpenQuestionInlineCard = ({ question, sessionId, askedByName = null }: Props) => {
  const answeredByName = useAppStore((state) => {
    if (question.answeredByAgentId == null) {
      return null;
    }
    const agents = state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS;
    return agents.find((agent) => agent.id === question.answeredByAgentId)?.name ?? null;
  });

  return (
    <div data-oq-anchor={question.id} className="min-w-0">
      {question.status === 'answered' ? (
        <AnsweredCard question={question} answeredByName={answeredByName} />
      ) : (
        <InteractiveQuestionCard
          question={question}
          sessionId={sessionId}
          askedByName={askedByName}
        />
      )}
    </div>
  );
};
