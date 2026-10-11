import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const BranchBodyColumn = ({ children }: Props) => (
  <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-[var(--column-frame)] flex-1 flex-col">
    {children}
  </div>
);
