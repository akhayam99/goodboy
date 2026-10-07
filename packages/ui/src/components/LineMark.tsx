import type { ReactNode } from 'react';
import { cn } from '../cn';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const LineMark = ({ children, className }: Props) => (
  <span data-slot="line-mark" className={cn('flex h-lh shrink-0 items-center', className)}>
    {children}
  </span>
);
