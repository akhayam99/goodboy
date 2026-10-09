import { Bell } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type ToastOverflowChipProps = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const ToastOverflowChip = ({ count, onOpen }: ToastOverflowChipProps) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      'pointer-events-auto inline-flex items-center gap-1 self-end rounded-full border border-border-soft',
      'bg-floating px-3 py-1 text-chip text-muted-foreground shadow-lg',
      'hover:bg-hover hover:text-foreground motion-safe:transition-colors',
    )}
  >
    <Bell size={ICON_SIZE.mark} aria-hidden />
    <span className="tabular-nums">+{count} more in notifications</span>
  </button>
);
