import { Button, Tooltip, TruncatedText } from '@goodboy/ui';
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
  const answer = (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      data-move-verb=""
      className="shrink-0"
      onClick={() => navigate({ to: questionPlace({ sessionId, questionId: question.id }) })}
    >
      {ANSWER}
    </Button>
  );
  return (
    <div
      data-move={`question:${question.id}`}
      data-move-density="row"
      data-move-primary={isPrimary ? '' : undefined}
      className="flex min-h-8 min-w-0 items-center gap-3"
    >
      <TruncatedText className="min-w-0 flex-1 text-ui text-foreground">
        {question.text}
      </TruncatedText>
      {isPrimary ? (
        <Tooltip content={ANSWER} shortcut="list.open">
          {answer}
        </Tooltip>
      ) : (
        answer
      )}
    </div>
  );
};
