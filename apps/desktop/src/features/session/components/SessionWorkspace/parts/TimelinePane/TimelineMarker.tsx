import type { ReactNode } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly tone: Tone;
  readonly isEmphasised?: boolean;
  readonly children: ReactNode;
};

export const TimelineMarker = ({ tone, isEmphasised = false, children }: Props) => {
  const tint = tintClasses(tone);
  return (
    <span
      className={cn(
        'flex size-5 items-center justify-center rounded-full ring-1',
        isEmphasised ? cn(tint.bg, tint.ringStrong) : cn('bg-background', tint.ring),
      )}
    >
      {children}
    </span>
  );
};
