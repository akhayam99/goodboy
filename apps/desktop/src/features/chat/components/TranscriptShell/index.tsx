import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { MARKER_ACCENT, type Tone } from '../marker-accents';

type Variant = 'boxed' | 'leftBorder' | 'pill';

type Props = {
  readonly tone: Tone;
  readonly variant: Variant;
  readonly children: ReactNode;
  readonly className?: string;
  readonly emphasis?: boolean;
  readonly nested?: boolean;
};

export const TranscriptShell = ({
  tone,
  variant,
  children,
  className,
  emphasis = false,
  nested = false,
}: Props) => {
  const accent = MARKER_ACCENT[tone];

  return (
    <div
      className={cn(
        variant === 'boxed' && 'rounded-md border px-3 py-2',
        variant === 'boxed' && accent.border,
        variant === 'boxed' && (emphasis ? accent.bg : accent.bgSoft),
        variant === 'leftBorder' &&
          (nested ? 'border-l py-2 pl-3 pr-2' : 'rounded-r-md border-l-2 py-1 pl-2 pr-2'),
        variant === 'leftBorder' && (nested ? accent.borderSoft : accent.border),
        variant === 'pill' && 'rounded-full border px-2.5 py-1',
        variant === 'pill' && accent.border,
        variant === 'pill' && accent.bg,
        className,
      )}
    >
      {children}
    </div>
  );
};
