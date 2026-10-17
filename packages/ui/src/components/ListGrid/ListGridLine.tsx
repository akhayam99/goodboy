import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { TEXT_ROLE } from '../../textRoles';

export type ListGridLineProps = {
  readonly children: ReactNode;
  readonly onClick?: () => void;
};

export const ListGridLine = ({ children, onClick }: ListGridLineProps) => (
  <li className="col-span-full grid h-8 grid-cols-subgrid items-center">
    {onClick === undefined ? (
      <span className={cn('col-start-2 col-end-[-2] min-w-0 truncate', TEXT_ROLE.hint)}>
        {children}
      </span>
    ) : (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'col-start-2 col-end-[-2] flex min-w-0 items-center justify-self-start rounded-md text-left hover:text-foreground',
          TEXT_ROLE.secondary,
          FOCUS_RING,
        )}
      >
        {children}
      </button>
    )}
  </li>
);
