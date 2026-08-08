import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type ChipProps = {
  readonly tone: Tone;
  readonly label?: ReactNode;
  readonly icon?: ReactNode;
  readonly trailing?: ReactNode;
  readonly size?: 'xs' | 'sm' | 'md';
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly shape?: 'pill' | 'badge';
  readonly bordered?: boolean;
  readonly emphasis?: 'soft' | 'strong';
  readonly as?: 'span' | 'button';
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly testId?: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
};

const sizeClasses: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'px-1.5 py-0.5 text-2xs',
  sm: 'text-2xs px-2 py-0.5',
  md: 'text-xs px-2 py-1',
};

const widthClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-w-16 justify-center',
  md: 'min-w-24 justify-center',
  lg: 'min-w-32 justify-center',
};

const strongRing: Record<Tone, string> = {
  success: 'ring-success/40',
  info: 'ring-info/40',
  warning: 'ring-warning/40',
  danger: 'ring-danger/40',
  primary: 'ring-primary/40',
  accent: 'ring-accent/40',
  merged: 'ring-merged/40',
  draft: 'ring-draft/40',
  operations: 'ring-primary/40',
  neutral: 'ring-border-soft',
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
  emphasis = 'soft',
  as = 'span',
  title,
  ariaLabel,
  testId,
  onClick,
  disabled = false,
  className,
}: ChipProps) => {
  const tint = tintClasses(tone);
  const classes = cn(
    'inline-flex items-center gap-1 font-medium',
    shape === 'pill' ? 'rounded-full' : 'rounded-md',
    tint.bg,
    tint.text,
    sizeClasses[size],
    width === 'auto' ? '' : widthClasses[width],
    bordered ? 'ring-1' : '',
    bordered ? (emphasis === 'strong' ? strongRing[tone] : tint.ring) : '',
    className,
  );

  const inner = (
    <>
      {icon}
      {label}
      {trailing}
    </>
  );

  if (as === 'button' || onClick) {
    return (
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        data-testid={testId}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'motion-safe:transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60',
          classes,
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <span title={title} aria-label={ariaLabel} data-testid={testId} className={classes}>
      {inner}
    </span>
  );
};
