import { ChevronRight } from 'lucide-react';
import { cn, StatusDot } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { QUESTION_DELEGATE_COPY } from '../../../questionDelegate';

type Props = {
  readonly onOpen: (() => void) | null;
  readonly onTakeBack: (() => void) | null;
};

export const DelegateWaitingRow = ({ onOpen, onTakeBack }: Props) => (
  <div className="flex min-w-0 items-center gap-2">
    <button
      type="button"
      data-testid="delegate-waiting-row"
      disabled={onOpen === null}
      onClick={onOpen ?? undefined}
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border-soft px-2 py-1.5',
        'text-left text-sm font-medium text-muted-foreground',
        'transition-[color,background-color,border-color] duration-150',
        'enabled:hover:border-border enabled:hover:bg-hover enabled:hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      )}
    >
      <StatusDot tone="info" size="sm" pulsing />
      <span className="min-w-0 flex-1 whitespace-normal break-words">
        {QUESTION_DELEGATE_COPY.running}
      </span>
      {onOpen !== null && (
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0 opacity-0 motion-safe:transition-opacity group-hover:opacity-100"
        />
      )}
    </button>
    {onTakeBack !== null && (
      <button
        type="button"
        data-testid="delegate-take-back"
        onClick={onTakeBack}
        className={cn(
          'shrink-0 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground',
          'transition-[color,background-color] duration-150',
          'hover:bg-hover hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        {QUESTION_DELEGATE_COPY.back}
      </button>
    )}
  </div>
);
