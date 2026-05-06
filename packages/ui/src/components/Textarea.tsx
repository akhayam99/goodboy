import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type TextareaProps = ComponentProps<'textarea'>;

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-16 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );
}
