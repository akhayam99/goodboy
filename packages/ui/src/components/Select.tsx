import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type SelectSize = 'sm' | 'md';

export interface Props extends Omit<ComponentProps<'select'>, 'size'> {
  size?: SelectSize;
  /** Stretch the wrapper to its container's width and make `<select>` w-full. */
  block?: boolean;
}

const SIZE: Record<SelectSize, string> = {
  sm: 'h-7 pl-2 pr-7 text-xs',
  md: 'h-8 pl-2.5 pr-8 text-sm',
};

const CHEVRON_OFFSET: Record<SelectSize, string> = {
  sm: 'right-1.5',
  md: 'right-2',
};

export function Select({ className, size = 'md', block = false, children, ...rest }: Props) {
  return (
    <span className={cn('relative items-center', block ? 'flex w-full' : 'inline-flex')}>
      <select
        className={cn(
          'appearance-none rounded-md border border-border bg-background text-foreground',
          'cursor-pointer transition-colors hover:border-foreground/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          SIZE[size],
          block && 'w-full',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        width={size === 'sm' ? 11 : 13}
        height={size === 'sm' ? 11 : 13}
        className={cn('pointer-events-none absolute text-muted-foreground', CHEVRON_OFFSET[size])}
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
