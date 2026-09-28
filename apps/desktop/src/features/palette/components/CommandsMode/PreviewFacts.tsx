import type { ReactNode } from 'react';

export type PreviewFact = {
  readonly label: string;
  readonly value: ReactNode;
};

type Props = {
  readonly facts: ReadonlyArray<PreviewFact>;
};

export const PreviewFacts = ({ facts }: Props) => (
  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-label">
    {facts.map((fact) => (
      <div key={fact.label} className="contents">
        <dt className="text-muted-foreground">{fact.label}</dt>
        <dd className="truncate text-foreground">{fact.value}</dd>
      </div>
    ))}
  </dl>
);
