import { Button, ToneBar } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { STAGE_TONE } from '../../../session/session-stage';
import { MoveAnswer } from './MoveAnswer';
import { moveVerbOf } from '../moveVerbOf';
import type { QueueMove } from '../needsYouOf';

type AnswerParams = {
  readonly text: string;
};

type Props = {
  readonly move: QueueMove;
  readonly kicker: string;
  readonly onAnswer: (params: AnswerParams) => void;
  readonly onOpenPage: () => void;
  readonly onOpenSession: () => void;
  readonly onNotNow: () => void;
};

const NOT_NOW = 'Not now';
const OPEN_IN_SESSION = 'Open in session';

export const QueueMoveCard = ({
  move,
  kicker,
  onAnswer,
  onOpenPage,
  onOpenSession,
  onNotNow,
}: Props) => {
  const verb = moveVerbOf({ reason: move.reason });
  const look = actionButtonLookOf({ verb, variant: 'primary' });
  const quiet = actionButtonLookOf({ verb: NOT_NOW, variant: 'ghost' });
  const open = actionButtonLookOf({ verb: OPEN_IN_SESSION, variant: 'secondary' });
  return (
    <div
      data-queue-move={move.id}
      data-queue-move-focus=""
      className="relative flex min-w-0 flex-col gap-2 rounded-lg bg-background p-3"
    >
      <ToneBar tone={STAGE_TONE.attention} density="card" />
      <span className="min-w-0 truncate text-meta text-muted-foreground">{kicker}</span>
      <span className="min-w-0 text-row text-foreground">{move.title}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {move.kind === 'answer' && move.question !== null ? (
          <MoveAnswer question={move.question} onAnswer={onAnswer} />
        ) : (
          <Button
            size="sm"
            variant={look.variant}
            intent={look.intent}
            data-move-primary=""
            onClick={onOpenPage}
          >
            {verb}
          </Button>
        )}
        {move.kind === 'answer' ? (
          <Button size="sm" variant={open.variant} intent={open.intent} onClick={onOpenSession}>
            {OPEN_IN_SESSION}
          </Button>
        ) : null}
        <Button size="sm" variant={quiet.variant} intent={quiet.intent} onClick={onNotNow}>
          {NOT_NOW}
        </Button>
      </div>
    </div>
  );
};
