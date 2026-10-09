import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const Frame = ({ children }: Props) => (
  <div className="flex min-h-full w-full flex-col gap-6 bg-background p-6 text-foreground">
    {children}
  </div>
);
