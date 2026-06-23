import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type InputProps = ComponentProps<'input'>;

export const Input = ({ className, type = 'text', ...rest }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(
        'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );
};
