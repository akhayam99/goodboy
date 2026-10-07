import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type KbdLook = 'inline' | 'cap';

export type KbdProps = ComponentProps<'kbd'> & {
  readonly look?: KbdLook;
};

const LOOK_CLASSES = {
  inline: 'font-sans text-meta text-faint-foreground',
  cap: 'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1 text-code text-muted-foreground',
} as const satisfies Record<KbdLook, string>;

export const Kbd = ({ look = 'inline', className, ...rest }: KbdProps) => {
  return <kbd data-look={look} className={cn(LOOK_CLASSES[look], className)} {...rest} />;
};
