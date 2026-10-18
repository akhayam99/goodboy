import type { ReactNode } from 'react';

type Props = {
  readonly stop?: ReactNode;
  readonly menu?: ReactNode;
};

export const ActionsCell = ({ stop, menu }: Props) => (
  <div data-actions-cell className="relative z-10 flex items-center justify-end gap-1">
    <span className="flex w-20 justify-end">{stop}</span>
    <span className="row-actions flex w-9 justify-center">{menu}</span>
  </div>
);
