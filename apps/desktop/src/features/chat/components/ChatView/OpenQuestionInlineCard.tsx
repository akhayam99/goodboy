import type { OpenQuestion, SessionId } from '@goodboy/types';
import { AnsweredCard } from './AnsweredCard';
import { InteractiveQuestionCard } from './InteractiveQuestionCard';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
};

export const OpenQuestionInlineCard = ({ question, sessionId }: Props) => {
  return (
    <div data-oq-anchor={question.id}>
      {question.status === 'answered' ? (
        <AnsweredCard question={question} />
      ) : (
        <InteractiveQuestionCard question={question} sessionId={sessionId} />
      )}
    </div>
  );
};
