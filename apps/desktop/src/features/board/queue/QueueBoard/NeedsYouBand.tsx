import { Button, SectionLabel } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { QueueMove } from '../needsYouOf';
import { QueueMoveCard } from './QueueMoveCard';
import { QueueMoveRow } from './QueueMoveRow';

type MoveParams = {
  readonly move: QueueMove;
};

type AnswerParams = MoveParams & {
  readonly text: string;
};

type Props = {
  readonly moves: ReadonlyArray<QueueMove>;
  readonly focusedId: string | null;
  readonly notNowCount: number;
  readonly isActive: boolean;
  readonly kickerOf: (params: MoveParams) => string;
  readonly onFocus: (params: MoveParams) => void;
  readonly onAnswer: (params: AnswerParams) => void;
  readonly onOpenPage: (params: MoveParams) => void;
  readonly onOpenSession: (params: MoveParams) => void;
  readonly onNotNow: (params: MoveParams) => void;
  readonly onShowHidden: () => void;
};

export const NeedsYouBand = ({
  moves,
  focusedId,
  notNowCount,
  isActive,
  kickerOf,
  onFocus,
  onAnswer,
  onOpenPage,
  onOpenSession,
  onNotNow,
  onShowHidden,
}: Props) => {
  const focused = moves.find((move) => move.id === focusedId) ?? moves[0];
  const showHidden = actionButtonLookOf({ verb: 'Show', variant: 'ghost' });
  return (
    <section
      aria-label={NAMES.needsYou}
      data-queue-band="needs-you"
      data-band-active={isActive ? '' : undefined}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-3 outline-none"
    >
      <SectionLabel
        label={NAMES.needsYou}
        headingLevel={2}
        count={moves.length > 1 ? moves.length : undefined}
      />
      {focused === undefined ? (
        <span className="text-ui text-muted-foreground">{NAMES.nothingWaitsOnYou}</span>
      ) : null}
      {moves.map((move) =>
        move === focused ? (
          <QueueMoveCard
            key={move.id}
            move={move}
            kicker={kickerOf({ move })}
            onAnswer={({ text }) => onAnswer({ move, text })}
            onOpenPage={() => onOpenPage({ move })}
            onOpenSession={() => onOpenSession({ move })}
            onNotNow={() => onNotNow({ move })}
          />
        ) : (
          <QueueMoveRow
            key={move.id}
            move={move}
            kicker={kickerOf({ move })}
            onFocus={() => onFocus({ move })}
          />
        ),
      )}
      {notNowCount > 0 ? (
        <Button
          size="xs"
          variant={showHidden.variant}
          intent={showHidden.intent}
          className="self-start"
          onClick={onShowHidden}
        >{`Show ${notNowCount} hidden`}</Button>
      ) : null}
    </section>
  );
};
