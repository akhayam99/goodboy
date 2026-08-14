import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';
import { StatusDot } from './StatusDot';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'accent' | 'info' | 'success';
export type ButtonSize = 'sm' | 'md';
export type ButtonEmphasis = 'solid' | 'outline';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
  variant?: ButtonVariant;
  emphasis?: ButtonEmphasis;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  isBusy?: boolean;
  busyLabel?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-muted text-foreground hover:bg-muted/70 border-border',
  ghost: 'border-0 text-foreground hover:bg-muted',
  danger: 'bg-danger text-danger-foreground hover:bg-danger/90',
  warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
  info: 'bg-info text-info-foreground hover:bg-info/90',
  success: 'bg-success text-success-foreground hover:bg-success/90',
};

const variantTone: Record<ButtonVariant, Tone> = {
  primary: 'primary',
  secondary: 'neutral',
  ghost: 'neutral',
  danger: 'danger',
  warning: 'warning',
  accent: 'accent',
  info: 'info',
  success: 'success',
};

const outlineClasses = (variant: ButtonVariant): string => {
  const tint = tintClasses(variantTone[variant]);
  return cn('bg-transparent', tint.border, tint.text, tint.hoverBorder, tint.hoverBg);
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
};

export const Button = ({
  variant = 'primary',
  emphasis = 'solid',
  size = 'md',
  type = 'button',
  isBusy = false,
  busyLabel,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) => {
  return (
    <button
      type={type}
      disabled={disabled || isBusy}
      aria-busy={isBusy ? true : undefined}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap gap-1.5 rounded-md border border-transparent font-medium motion-safe:transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        emphasis === 'outline' ? outlineClasses(variant) : variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {isBusy ? (
        <>
          <StatusDot tone="neutral" size={size} pulsing className="bg-current" />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
};
