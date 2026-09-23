import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { tintClasses, type Tone } from '../tint';

export type ChipSize = '3xs' | 'xs' | 'sm' | 'md' | 'control';
export type ChipEmphasis = 'subtle' | 'soft' | 'strong';

export type ChipProps = {
  readonly tone: Tone;
  readonly label?: ReactNode;
  readonly icon?: ReactNode;
  readonly trailing?: ReactNode;
  readonly size?: ChipSize;
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly shape?: 'pill' | 'badge';
  readonly bordered?: boolean;
  readonly uppercase?: boolean;
  readonly emphasis?: ChipEmphasis;
  readonly as?: 'span' | 'button';
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly ariaPressed?: boolean;
  readonly testId?: string;
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly disabled?: boolean;
  readonly expanded?: boolean;
  readonly hasPopup?: 'dialog' | 'menu' | 'listbox' | 'true';
  readonly className?: string;
};

const sizeClasses: Record<ChipSize, string> = {
  '3xs': 'px-1.5 py-0.5 text-3xs',
  xs: 'px-1.5 py-0.5 text-2xs',
  sm: 'text-2xs px-2 py-0.5',
  md: 'text-xs px-2 py-1',
  control: 'h-6 shrink-0 gap-1.5 px-2 text-2xs',
};

const widthClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-w-16 justify-center',
  md: 'min-w-24 justify-center',
  lg: 'min-w-32 justify-center',
};

export type ChipClassParams = {
  readonly tone: Tone;
  readonly size?: ChipSize;
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly shape?: 'pill' | 'badge';
  readonly bordered?: boolean;
  readonly uppercase?: boolean;
  readonly emphasis?: ChipEmphasis;
  readonly isInteractive?: boolean;
};

export const chipClasses = ({
  tone,
  size = 'xs',
  width = 'auto',
  shape = 'pill',
  bordered = true,
  uppercase = false,
  emphasis = 'soft',
  isInteractive = false,
}: ChipClassParams): string => {
  const tint = tintClasses(tone);
  return cn(
    'inline-flex items-center gap-1 font-medium',
    shape === 'pill' ? 'rounded-full' : 'rounded-md',
    emphasis === 'subtle' ? tint.bgSoft : tint.bg,
    tint.text,
    sizeClasses[size],
    uppercase ? 'uppercase tracking-eyebrow' : '',
    width === 'auto' ? '' : widthClasses[width],
    bordered ? 'ring-1' : '',
    bordered ? (emphasis === 'strong' ? tint.ringStrong : tint.ring) : '',
    isInteractive
      ? cn(
          'motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          FOCUS_RING,
          tint.hoverBg,
          tint.hoverText,
        )
      : '',
  );
};

export const Chip = ({
  tone,
  label,
  icon,
  trailing,
  size = 'xs',
  width = 'auto',
  shape = 'pill',
  bordered = true,
  uppercase = false,
  emphasis = 'soft',
  as = 'span',
  title,
  ariaLabel,
  ariaPressed,
  testId,
  onClick,
  disabled = false,
  expanded,
  hasPopup,
  className,
}: ChipProps) => {
  const isButton = as === 'button' || onClick !== undefined;
  const classes = cn(
    chipClasses({
      tone,
      size,
      width,
      shape,
      bordered,
      uppercase,
      emphasis,
      isInteractive: isButton,
    }),
    className,
  );

  const inner = (
    <>
      {icon}
      {label}
      {trailing}
    </>
  );

  if (isButton) {
    return (
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        data-testid={testId}
        aria-expanded={expanded}
        aria-haspopup={hasPopup}
        onClick={onClick}
        disabled={disabled}
        className={classes}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      title={title}
      role={ariaLabel == null ? undefined : 'img'}
      aria-label={ariaLabel}
      data-testid={testId}
      className={classes}
    >
      {inner}
    </span>
  );
};
