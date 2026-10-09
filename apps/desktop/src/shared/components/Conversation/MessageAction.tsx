import type { LucideIcon } from 'lucide-react';
import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

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
        'inline-flex h-6 items-center gap-1 rounded-sm px-2 text-chip text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50',
        FOCUS_RING,
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden />
      {label}
    </button>
  </Tooltip>
);
