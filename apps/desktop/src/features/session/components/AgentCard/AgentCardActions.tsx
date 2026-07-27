import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly className?: string;
  readonly children: ReactNode;
};

export const AgentCardActions = ({ className, children }: Props) => (
  <div
    role="group"
    aria-label="agent actions"
    className={cn('flex shrink-0 items-center justify-end gap-1', className)}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    {children}
  </div>
);
