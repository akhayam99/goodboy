import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { ICON_SIZE } from '../iconSize';
import { tintClasses, type Tone } from '../tint';
import { Tooltip } from './Tooltip';

export type IconButtonSize = 'xs' | 'sm' | 'md';

export type IconButtonProps = Omit<ComponentProps<'button'>, 'type' | 'children' | 'title'> & {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  size?: IconButtonSize;
  iconSize?: number;
  busy?: boolean;
  tone?: Tone;
  variant?: 'outline' | 'ghost';
  type?: 'button' | 'submit' | 'reset';
};

export const ICON_BUTTON_SIZE_CLASSES = {
  xs: 'size-6',
  sm: 'size-7',
  md: 'size-8',
} as const satisfies Record<IconButtonSize, string>;

export const ICON_BUTTON_GLYPH = {
  xs: ICON_SIZE.row,
  sm: ICON_SIZE.control,
  md: ICON_SIZE.control,
} as const satisfies Record<IconButtonSize, number>;

const toneClasses = (tone: Tone, variant: 'outline' | 'ghost'): string => {
  const tint = tintClasses(tone);
  if (variant === 'ghost') {
    return cn(tint.text, tint.hoverBg);
  }
  return cn(tint.borderSoft, tint.text, tint.hoverBorder, tint.hoverBg);
};

export const IconButton = ({
  icon: Icon,
  label,
  tooltip,
  size = 'sm',
  iconSize,
  busy = false,
  tone = 'neutral',
  variant = 'ghost',
  type = 'button',
  disabled = false,
  className,
  ...rest
}: IconButtonProps) => {
  return (
    <Tooltip content={tooltip ?? label}>
      <button
        type={type}
        aria-label={label}
        aria-busy={busy ? true : undefined}
        disabled={disabled || busy}
        data-size={size}
        data-variant={variant}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md',
          ICON_BUTTON_SIZE_CLASSES[size],
          'text-muted-foreground motion-safe:transition-colors',
          variant === 'outline'
            ? 'border border-border-soft hover:border-border hover:bg-hover'
            : 'border border-transparent hover:bg-hover',
          'hover:text-foreground disabled:text-disabled-foreground disabled:hover:bg-transparent',
          FOCUS_RING,
          tone !== 'neutral' && toneClasses(tone, variant),
          className,
        )}
        {...rest}
      >
        <Icon
          size={iconSize ?? ICON_BUTTON_GLYPH[size]}
          aria-hidden
          className={cn('shrink-0', busy && 'motion-safe:animate-soft-pulse')}
        />
      </button>
    </Tooltip>
  );
};
