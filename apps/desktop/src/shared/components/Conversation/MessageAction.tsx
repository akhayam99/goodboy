import type { LucideIcon } from 'lucide-react';
import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tooltip: string | null;
  readonly isDisabled?: boolean;
  readonly onRun: () => void;
};

export const MessageAction = ({ icon: Icon, label, tooltip, isDisabled = false, onRun }: Props) => (
  <Tooltip content={tooltip ?? label}>
    <button
      type="button"
      disabled={isDisabled}
      onClick={onRun}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-secondary text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50',
        FOCUS_RING,
      )}
    >
      <Icon size={12} aria-hidden />
      {label}
    </button>
  </Tooltip>
);
