export type RowCardFact = {
  readonly label: string;
  readonly value: string;
};

type Props = {
  readonly facts: ReadonlyArray<RowCardFact>;
};

export const RowCardFacts = ({ facts }: Props) => (
  <dl className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-meta">
    {facts.map((fact) => (
      <div key={fact.label} className="contents">
        <dt className="text-muted-foreground">{fact.label}</dt>
        <dd className="whitespace-nowrap tabular-nums text-foreground">{fact.value}</dd>
      </div>
    ))}
  </dl>
);
