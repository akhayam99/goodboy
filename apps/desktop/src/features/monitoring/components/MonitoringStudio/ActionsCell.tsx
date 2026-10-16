import type { ReactNode } from 'react';

type Props = {
  readonly stop?: ReactNode;
  readonly actions?: ReactNode;
};

export const ActionsCell = ({ stop, actions }: Props) => (
  <div data-actions-cell className="relative z-10 flex items-center justify-end gap-1">
    <span className="flex w-10 justify-end">{stop}</span>
    <span className="flex w-9 justify-center">{actions}</span>
  </div>
);
