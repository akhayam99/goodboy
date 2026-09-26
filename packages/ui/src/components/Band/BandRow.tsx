import type { ReactNode } from 'react';
import { cn } from '../../cn';

type Props = {
  readonly children: ReactNode;
  readonly isInteractive?: boolean;
  readonly className?: string;
};

export const BAND_ROW_CLASS = 'flex min-h-9 items-center gap-2 rounded-sm px-2 py-1.5';

export const BandRow = ({ children, isInteractive = false, className }: Props) => (
  <div
    className={cn(
      BAND_ROW_CLASS,
      isInteractive && 'motion-safe:transition-colors hover:bg-hover',
      className,
    )}
  >
    {children}
  </div>
);
