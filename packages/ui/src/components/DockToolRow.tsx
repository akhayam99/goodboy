import type { ReactNode } from 'react';
import { cn } from '../cn';

type Props = {
  readonly scope?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children?: ReactNode;
};

export const DockToolRow = ({ scope, actions, className, children }: Props) => (
  <div
    data-dock-tool-row=""
    className={cn('flex h-9 min-w-0 shrink-0 items-center gap-1 px-2', className)}
  >
    {scope == null ? null : (
      <div data-dock-tool-scope="" className="flex min-w-0 max-w-[50%] shrink items-center">
        {scope}
      </div>
    )}
    <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
    {actions == null ? null : (
      <div data-dock-tool-actions="" className="flex shrink-0 items-center gap-1">
        {actions}
      </div>
    )}
  </div>
);
