import type { ReactNode } from 'react';
import { cn } from '../../cn';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const BandStack = ({ children, className }: Props) => (
  <div className={cn('flex flex-col gap-2', className)}>{children}</div>
);
