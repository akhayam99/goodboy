import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const ThreadPropertyRow = ({ label, children }: Props) => (
  <span className="inline-flex min-w-0 items-baseline gap-1 text-meta text-muted-foreground">
    {label}
    <span className="min-w-0 text-foreground">{children}</span>
  </span>
);
