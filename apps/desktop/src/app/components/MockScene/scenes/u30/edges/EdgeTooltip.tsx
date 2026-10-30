import { Square } from 'lucide-react';
import { ICON_SIZE, Tooltip, type TooltipSide } from '@goodboy/ui';

type Props = {
  readonly className: string;
  readonly label: string;
  readonly side: TooltipSide;
};

export const EdgeTooltip = ({ className, label, side }: Props) => (
  <div className={className}>
    <Tooltip content={label} side={side} isOpen>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border-soft bg-subtle text-muted-foreground"
      >
        <Square size={ICON_SIZE.row} aria-hidden />
      </button>
    </Tooltip>
  </div>
);
