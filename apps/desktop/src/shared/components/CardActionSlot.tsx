import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export const CardActionSlot = ({ label, className, children }: Props) => (
  <div
    role="group"
    aria-label={label}
    className={cn('flex shrink-0 items-center justify-end gap-1', className)}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    {children}
  </div>
);
