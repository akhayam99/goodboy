import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses, Tooltip, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone?: Tone;
  readonly size?: 'compact' | 'default';
  readonly reveal?: boolean;
  readonly highlighted?: boolean;
  readonly pressed?: boolean;
  readonly expanded?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
};

export const CardAction = ({
  icon: Icon,
  label,
  tone = 'neutral',
  size = 'compact',
  reveal = false,
  highlighted = false,
  pressed,
  expanded,
  disabled = false,
  onClick,
}: Props) => (
  <Tooltip content={label} side="top">
    <span className={cn('inline-flex shrink-0', size === 'compact' ? 'size-6' : 'size-7')}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cn(
          'inline-flex size-full shrink-0 items-center justify-center rounded-md font-medium text-muted-foreground transition-[background-color,color,opacity] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:pointer-events-none disabled:opacity-40',
          size === 'compact' ? 'text-3xs' : 'text-xs',
          tintClasses(tone).hoverBgSoft,
          tintClasses(tone).hoverText,
          reveal &&
            'opacity-0 group-hover/agent-card:opacity-100 group-focus-within/agent-card:opacity-100',
          highlighted && cn(tintClasses(tone).bgSoft, tintClasses(tone).text),
        )}
      >
        <Icon size={size === 'compact' ? 12 : 14} aria-hidden />
      </button>
    </span>
  </Tooltip>
);
