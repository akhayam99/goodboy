import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const Fact = ({ label, children }: Props) => (
  <>
    <dt className="text-meta text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-body text-foreground">{children}</dd>
  </>
);
