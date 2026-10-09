import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { StatusDot } from './StatusDot';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet' | 'ghost-danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  isBusy?: boolean;
  busyLabel?: string;
};

export const BUTTON_VARIANT_CLASSES = {
  primary:
    'bg-primary text-on-tone hover:bg-primary/90 disabled:bg-fill disabled:text-disabled-foreground',
  secondary:
    'bg-fill text-foreground hover:bg-hover border-border disabled:bg-fill disabled:text-disabled-foreground',
  ghost:
    'border-0 text-foreground hover:bg-hover disabled:bg-transparent disabled:text-disabled-foreground',
  quiet:
    'border-0 text-muted-foreground hover:bg-hover hover:text-foreground disabled:bg-transparent disabled:text-disabled-foreground',
  danger:
    'bg-danger text-on-tone hover:bg-danger/90 disabled:bg-fill disabled:text-disabled-foreground',
  'ghost-danger':
    'border-0 text-danger hover:bg-danger/10 disabled:bg-transparent disabled:text-disabled-foreground',
} as const satisfies Record<ButtonVariant, string>;

export const BUTTON_SIZE_CLASSES = {
  xs: 'h-6 gap-1 px-2 text-label',
  sm: 'h-7 gap-2 px-3 text-label',
  md: 'h-8 gap-2 px-3 text-body',
} as const satisfies Record<ButtonSize, string>;

export const Button = ({
  variant = 'primary',
  size = 'sm',
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
      data-size={size}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium motion-safe:transition-colors disabled:pointer-events-none',
        FOCUS_RING,
        BUTTON_VARIANT_CLASSES[variant],
        BUTTON_SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {isBusy ? (
        <>
          <StatusDot
            tone="neutral"
            size={size === 'md' ? 'md' : 'sm'}
            pulsing
            className="bg-current"
          />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
};
