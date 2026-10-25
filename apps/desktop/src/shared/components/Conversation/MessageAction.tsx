import type { LucideIcon } from 'lucide-react';
import { cn, FOCUS_RING, ICON_SIZE, OptionalTooltip } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tooltip: string | null;
  readonly isDisabled?: boolean;
  readonly onRun: () => void;
};

export const MessageAction = ({ icon: Icon, label, tooltip, isDisabled = false, onRun }: Props) => (
  <OptionalTooltip content={tooltip}>
    <button
      type="button"
      disabled={isDisabled}
      onClick={onRun}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm px-2 text-chip text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50',
        FOCUS_RING,
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden />
      {label}
    </button>
  </OptionalTooltip>
);
