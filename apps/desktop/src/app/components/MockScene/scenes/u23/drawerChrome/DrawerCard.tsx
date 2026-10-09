import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const DrawerCard = ({ children }: Props) => (
  <div className="flex h-[640px] w-[420px] min-w-0 flex-col overflow-hidden rounded-frame border border-border bg-subtle">
    {children}
  </div>
);
