import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type Props = ComponentProps<'kbd'>;

export function KbdPill({ className, ...rest }: Props) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-xs text-muted-foreground',
        className,
      )}
      {...rest}
    />
  );
}
