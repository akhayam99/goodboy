import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const FixRunNote = ({ label, children }: Props) => (
  <section className="flex min-w-0 flex-col gap-1">
    <h2 className="text-label text-muted-foreground">{label}</h2>
    {children}
  </section>
);
