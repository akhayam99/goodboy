import type { OpenQuestion, SessionId } from '@goodboy/types';
import { AnsweredCard } from './AnsweredCard';
import { InteractiveQuestionCard } from './InteractiveQuestionCard';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
  readonly askedByName?: string | null;
};

export const OpenQuestionInlineCard = ({ question, sessionId, askedByName = null }: Props) => {
  return (
    <div data-oq-anchor={question.id} className="min-w-0">
      {question.status === 'answered' ? (
        <AnsweredCard question={question} />
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
