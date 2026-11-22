import { Button, TruncatedText } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { questionPlace, useAppStore } from '../../../../store';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';

type Props = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
  readonly isPrimary: boolean;
};

const ANSWER = 'Answer';

export const NeedsYouQuestion = ({ sessionId, question, isPrimary }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const look = actionButtonLookOf({ verb: ANSWER, variant: isPrimary ? 'primary' : 'secondary' });
  return (
    <div
      data-move={`question:${question.id}`}
      data-move-density="row"
      className="flex min-h-8 min-w-0 items-center gap-3"
    >
      <TruncatedText className="min-w-0 flex-1 text-ui text-foreground">
        {question.text}
      </TruncatedText>
      <Button
        size="sm"
        variant={look.variant}
        intent={look.intent}
        className="shrink-0"
        onClick={() => navigate({ to: questionPlace({ sessionId, questionId: question.id }) })}
      >
        {ANSWER}
      </Button>
    </div>
  );
};
