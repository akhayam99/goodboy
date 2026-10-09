import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type KbdLook = 'inline' | 'cap';

export type KbdProps = ComponentProps<'kbd'> & {
  readonly look?: KbdLook;
  readonly isOnTone?: boolean;
};

const LOOK_CLASSES = {
  inline: 'font-sans text-meta text-faint-foreground',
  cap: 'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1 text-code text-muted-foreground',
} as const satisfies Record<KbdLook, string>;

const ON_TONE_CLASSES = {
  inline: 'text-on-tone',
  cap: 'border-on-tone/30 bg-on-tone/15 text-on-tone',
} as const satisfies Record<KbdLook, string>;

const CHORD_GLYPHS = /[⌘⌃⌥⇧+]/;

export const isChordHint = (glyphs: string): boolean => CHORD_GLYPHS.test(glyphs);

export const Kbd = ({ look = 'inline', isOnTone = false, className, ...rest }: KbdProps) => {
  return (
    <kbd
      data-look={look}
      className={cn(LOOK_CLASSES[look], isOnTone && ON_TONE_CLASSES[look], className)}
      {...rest}
    />
  );
};
