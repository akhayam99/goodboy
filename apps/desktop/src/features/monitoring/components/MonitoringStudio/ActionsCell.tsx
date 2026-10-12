import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly stop?: ReactNode;
  readonly actions?: ReactNode;
  readonly isRevealedOnHover?: boolean;
};

export const ActionsCell = ({ stop, actions, isRevealedOnHover = false }: Props) => (
  <div
    data-actions-cell
    className={cn(
      'relative z-10 flex items-center justify-end gap-1',
      isRevealedOnHover &&
        'opacity-0 motion-safe:transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100',
    )}
  >
    <span className="flex w-10 justify-end">{stop}</span>
    <span className="flex w-9 justify-center">{actions}</span>
  </div>
);
