import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { LiveQuestionCard } from '../../../context/components/QuestionsTab/LiveQuestionCard';
import { AnsweredCard } from './AnsweredCard';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const OpenQuestionInlineCard = ({ question, sessionId }: Props) => {
  const answeredByName = useAppStore((state) => {
    if (question.answeredByAgentId == null) {
      return null;
    }
    const agents = state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS;
    return agents.find((agent) => agent.id === question.answeredByAgentId)?.name ?? null;
  });

  if (question.status !== 'answered') {
    return <LiveQuestionCard question={question} sessionId={sessionId} variant="compact" />;
  }

  return (
    <div data-oq-anchor={question.id} className="min-w-0">
      <AnsweredCard question={question} answeredByName={answeredByName} />
    </div>
  );
};
