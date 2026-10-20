import type { ReactNode } from 'react';
import { FOCUS_RING, FactCard, Tooltip, cn, type Fact } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { HistoryAction } from '../../historyRowMarks';
import { historyMarkCardOf } from './historyMarkCardOf';

type Props = {
  readonly action: HistoryAction;
  readonly label: string;
  readonly facts?: ReadonlyArray<Fact>;
  readonly note?: string;
  readonly children: ReactNode;
  readonly isExpanded?: boolean;
  readonly onToggle?: () => void;
};

const MARK =
  'inline-flex h-5 min-w-7 shrink-0 items-center justify-center gap-px rounded-md border px-2 text-chip tabular-nums whitespace-nowrap';

export const HistoryChangeMark = ({
  action,
  label,
  facts = [],
  note,
  children,
  isExpanded,
  onToggle,
}: Props) => {
  const mark =
    onToggle === undefined ? (
      <span
        role="img"
        data-mark={action}
        aria-label={label}
        className={cn(MARK, HISTORY_ACTION_CLASSES[action].mark)}
      >
        {children}
      </span>
    ) : (
      <button
        type="button"
        data-mark={action}
        aria-label={label}
        aria-expanded={isExpanded === true}
        onClick={onToggle}
        className={cn(MARK, FOCUS_RING, HISTORY_ACTION_CLASSES[action].mark, 'cursor-pointer')}
      >
        {children}
      </button>
    );
  if (facts.length === 0 && note === undefined) {
    return <Tooltip content={label}>{mark}</Tooltip>;
  }
  return <FactCard card={historyMarkCardOf({ label, facts, note })}>{mark}</FactCard>;
};
