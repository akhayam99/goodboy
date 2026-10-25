import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { DISABLED } from '../disabledStyle';
import { ICON_SIZE } from '../iconSize';
import { tintClasses, type Tone } from '../tint';
import { Tooltip } from './Tooltip';

export type CardActionProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tooltip?: string;
  readonly tone?: Tone;
  readonly size?: 'compact' | 'default';
  readonly highlighted?: boolean;
  readonly pressed?: boolean;
  readonly expanded?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
};

export const CardAction = ({
  icon: Icon,
  label,
  tooltip,
  tone = 'neutral',
  size = 'compact',
  highlighted = false,
  pressed,
  expanded,
  disabled = false,
  onClick,
}: CardActionProps) => {
  return (
    <Tooltip
      content={tooltip ?? label}
      side="top"
      anchorClassName={cn('shrink-0', size === 'compact' ? 'size-6' : 'size-7')}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        data-highlighted={highlighted ? '' : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cn(
          'inline-flex size-full shrink-0 items-center justify-center rounded-md font-medium text-muted-foreground transition-[background-color,color,opacity] focus-visible:opacity-100',
          FOCUS_RING,
          size === 'compact' ? 'text-chip' : 'text-meta',
          tintClasses(tone).hoverBgSoft,
          tintClasses(tone).hoverText,
          disabled && cn(DISABLED, 'hover:bg-transparent hover:text-disabled-foreground'),
          highlighted && cn(tintClasses(tone).bgSoft, tintClasses(tone).text),
        )}
      >
        <Icon size={size === 'compact' ? ICON_SIZE.row : ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  );
};
