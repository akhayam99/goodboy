import { Bell } from 'lucide-react';
import { cn } from '@goodboy/ui';

type ToastOverflowChipProps = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const ToastOverflowChip = ({ count, onOpen }: ToastOverflowChipProps) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      'pointer-events-auto inline-flex items-center gap-1.5 self-end rounded-full border border-border-soft',
      'bg-floating px-3 py-1 text-2xs font-medium text-muted-foreground shadow-lg',
      'hover:bg-hover hover:text-foreground motion-safe:transition-colors',
    )}
  >
    <Bell size={11} aria-hidden />
    <span className="tabular-nums">+{count} more in notifications</span>
  </button>
);
