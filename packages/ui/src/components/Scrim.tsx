import type { MouseEventHandler } from 'react';
import { cn } from '../cn';

export type ScrimProps = {
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  testId?: string;
  className?: string;
};

export const Scrim = ({ onMouseDown, testId, className }: ScrimProps) => (
  <div
    aria-hidden
    data-testid={testId}
    onMouseDown={onMouseDown}
    className={cn('absolute inset-0 bg-scrim motion-safe:animate-fade-in', className)}
  />
);
