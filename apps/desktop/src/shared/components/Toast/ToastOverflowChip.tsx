import { Bell } from 'lucide-react';
import { cn, FLOATING_SURFACE, ICON_SIZE } from '@goodboy/ui';

type ToastOverflowChipProps = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const ToastOverflowChip = ({ count, onOpen }: ToastOverflowChipProps) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      FLOATING_SURFACE,
      'pointer-events-auto inline-flex items-center gap-1 self-end rounded-full border-border-soft',
      'px-3 py-1 text-chip text-muted-foreground',
      'hover:bg-hover hover:text-foreground motion-safe:transition-colors',
    )}
  >
    <Bell size={ICON_SIZE.mark} aria-hidden />
    <span className="tabular-nums">+{count} more in notifications</span>
  </button>
);
