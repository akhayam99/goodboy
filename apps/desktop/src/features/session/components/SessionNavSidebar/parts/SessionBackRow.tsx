import { ChevronLeft } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly onBack: () => void;
};

export const SessionBackRow = ({ title, onBack }: Props) => (
  <Tooltip content={title} side="bottom">
    <button
      type="button"
      onClick={onBack}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-md text-left',
        PANE_RHYTHM.navRail.row,
        'text-foreground transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
      )}
    >
      <span className="flex w-5 flex-none items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground">
        <ChevronLeft size={14} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
    </button>
  </Tooltip>
);
