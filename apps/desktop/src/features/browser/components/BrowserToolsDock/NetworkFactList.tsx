import { TruncatedText } from '@goodboy/ui';

type Fact = {
  readonly label: string;
  readonly value: string;
};

type Props = {
  readonly label: string;
  readonly facts: ReadonlyArray<Fact>;
};

export const NetworkFactList = ({ label, facts }: Props) => (
  <dl aria-label={label} className="flex min-w-0 flex-col gap-0.5 text-code">
    {facts.map((fact, index) => (
      <div key={`${index}-${fact.label}`} className="flex min-w-0 gap-3">
        <dt className="flex w-32 shrink-0">
          <TruncatedText className="min-w-0 text-faint-foreground">{fact.label}</TruncatedText>
        </dt>
        <dd className="min-w-0 flex-1 break-words text-foreground">{fact.value}</dd>
      </div>
    ))}
  </dl>
);
