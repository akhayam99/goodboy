import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses } from '../tint';

type Props = {
  readonly isWashed: boolean;
  readonly children: ReactNode;
};

export const EntryWash = ({ isWashed, children }: Props) => (
  <div
    data-entry-wash={isWashed ? 'on' : 'off'}
    className={cn(
      'min-w-0 rounded-lg motion-safe:transition-colors motion-safe:duration-1400 motion-safe:ease-exit',
      isWashed ? tintClasses('primary').bg : 'bg-transparent',
    )}
  >
    {children}
  </div>
);
