import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type Props = ComponentProps<'div'>;

export function ScrollArea({ className, ...rest }: Props) {
  return (
    <div
      className={cn(
        'overflow-auto [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]',
        className,
      )}
      {...rest}
    />
  );
}
