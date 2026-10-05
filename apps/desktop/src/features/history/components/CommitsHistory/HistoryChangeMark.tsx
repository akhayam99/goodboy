import type { ReactNode } from 'react';
import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { HistoryAction } from '../../historyRowMarks';

type Props = {
  readonly action: HistoryAction;
  readonly label: string;
  readonly detail?: string;
  readonly children: ReactNode;
  readonly isExpanded?: boolean;
  readonly onToggle?: () => void;
};

const MARK =
  'inline-flex h-5 min-w-7 shrink-0 items-center justify-center gap-px rounded-md border px-2 text-chip tabular-nums whitespace-nowrap';

export const HistoryChangeMark = ({
  action,
  label,
  detail,
  children,
  isExpanded,
  onToggle,
}: Props) => {
  const content = (
    <span className="flex max-w-80 flex-col">
      <span>{label}</span>
      {detail === undefined ? null : <span className="text-faint-foreground">{detail}</span>}
    </span>
  );
  if (onToggle !== undefined) {
    return (
      <Tooltip content={content}>
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
      </Tooltip>
    );
  }
  return (
    <Tooltip content={content}>
      <span
        role="img"
        data-mark={action}
        aria-label={label}
        className={cn(MARK, HISTORY_ACTION_CLASSES[action].mark)}
      >
        {children}
      </span>
    </Tooltip>
  );
};
