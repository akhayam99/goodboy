import type { ReactNode } from 'react';

type Props = {
  readonly question: string;
  readonly children: ReactNode;
};

export const InspectorSection = ({ question, children }: Props) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
      {question}
    </h3>
    {children}
  </section>
);
