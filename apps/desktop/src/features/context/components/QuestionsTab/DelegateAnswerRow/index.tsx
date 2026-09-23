import { Bot, RotateCcw } from 'lucide-react';
import { cn, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { QUESTION_DELEGATE_COPY, type DelegateRowState } from '../../../questionDelegate';

type Props = {
  readonly state: DelegateRowState;
  readonly onChoose: () => void;
};

const ROW_FRAME =
  'flex w-full min-w-0 items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-left text-sm font-medium';

const LABEL: Readonly<Record<DelegateRowState, string>> = {
  available: QUESTION_DELEGATE_COPY.offer,
  chosen: QUESTION_DELEGATE_COPY.offer,
  running: QUESTION_DELEGATE_COPY.running,
  retry: QUESTION_DELEGATE_COPY.retry,
  blocked: QUESTION_DELEGATE_COPY.offer,
};

export const DelegateAnswerRow = ({ state, onChoose }: Props) => {
  const isBlocked = state === 'blocked';
  const isInert = isBlocked || state === 'running' || state === 'chosen';

  const row = (
    <button
      type="button"
      data-testid="delegate-answer-row"
      data-state={state}
      disabled={isInert}
      title={isBlocked ? QUESTION_DELEGATE_COPY.blocked : undefined}
      onClick={onChoose}
      className={cn(
        ROW_FRAME,
        'transition-[color,background-color,border-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        isInert
          ? 'border-border-soft text-faint-foreground'
          : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {state === 'retry' ? (
        <RotateCcw size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      ) : (
        <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      )}
      <span className="min-w-0 whitespace-normal break-words">{LABEL[state]}</span>
    </button>
  );

  if (!isBlocked) {
    return row;
  }

  return (
    <Tooltip content={QUESTION_DELEGATE_COPY.blocked} anchorClassName="w-full">
      {row}
    </Tooltip>
  );
};
