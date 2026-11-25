import { Button, Tooltip } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { questionPlace, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { NeedsYouTile } from '../MoveCard/NeedsYouTile';

type Props = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
  readonly isPrimary: boolean;
};

const ANSWER = 'Answer';

const QUESTION = 'Question';

export const NeedsYouQuestion = ({ sessionId, question, isPrimary }: Props) => {
  const now = useNow(30_000);
  const navigate = useAppStore((state) => state.navigate);
  const look = actionButtonLookOf({ verb: ANSWER, variant: isPrimary ? 'primary' : 'quiet' });
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
  const actions = isPrimary ? (
    <Tooltip content={ANSWER} shortcut="list.open">
      {answer}
    </Tooltip>
  ) : (
    answer
  );
  return (
    <NeedsYouTile
      moveId={`question:${question.id}`}
      sentKey={null}
      isPrimary={isPrimary}
      title={question.text}
      meta={joinFacts({ facts: [QUESTION, formatAge({ from: question.createdAt, now })] })}
      actions={actions}
      below={null}
    />
  );
};
