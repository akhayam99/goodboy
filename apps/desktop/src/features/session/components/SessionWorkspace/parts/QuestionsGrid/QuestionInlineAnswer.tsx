import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { QuestionAnswerCard } from '../../../QuestionAnswerCard';

type DismissedParams = {
  readonly question: OpenQuestion;
};

type Props = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
  readonly onDismissed: (params: DismissedParams) => void;
  readonly onDone: () => void;
};

export const QuestionInlineAnswer = ({ sessionId, question, onDismissed, onDone }: Props) => {
  const dismissOpenQuestion = useAppStore((state) => state.dismissOpenQuestion);

  const dismiss = async () => {
    await dismissOpenQuestion(sessionId, question);
    onDismissed({ question });
    onDone();
  };

  return (
    <li data-question-inline={question.id} className="col-span-full grid grid-cols-subgrid pb-2">
      <div className="col-start-2 col-end-[-1] min-w-0">
        <QuestionAnswerCard
          question={question}
          sessionId={sessionId}
          variant="compact"
          autoFocus
          onAnswered={onDone}
          onDismiss={() => void dismiss()}
        />
      </div>
    </li>
  );
};
