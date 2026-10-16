type Params = {
  readonly facts: ReadonlyArray<string | null | undefined | false>;
};

export const joinFacts = ({ facts }: Params): string =>
  facts
    .flatMap((fact) => (typeof fact === 'string' ? [fact.trim()] : []))
    .filter((fact) => fact.length > 0)
    .join(' · ');
