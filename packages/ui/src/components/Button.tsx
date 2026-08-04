import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
  variant?: ButtonVariant;
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
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
};

const spinnerSize: Record<ButtonSize, number> = {
  sm: 11,
  md: 13,
};

export const Button = ({
  variant = 'primary',
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
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {isBusy ? (
        <>
          <Loader2
            size={spinnerSize[size]}
            aria-hidden
            className="motion-safe:animate-spin opacity-80"
          />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
};
