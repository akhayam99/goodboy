import type { ReactNode } from 'react';
import { cn } from '../cn';
import { ScrollFade } from './ScrollFade';

export type PopoverBodyProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const PopoverBody = ({ children, className }: PopoverBodyProps) => (
  <ScrollFade
    className={cn('flex min-h-0 flex-1 flex-col', className)}
    viewportClassName="h-auto min-h-0 flex-1"
    fadeSize={12}
    fadeFrom="floating"
  >
    {children}
  </ScrollFade>
);
