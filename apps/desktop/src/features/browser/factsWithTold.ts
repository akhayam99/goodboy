import type { BrowserTabFacts } from './types';

type Params = {
  readonly facts: ReadonlyArray<BrowserTabFacts>;
  readonly told: BrowserTabFacts;
};

export const factsWithTold = ({ facts, told }: Params): ReadonlyArray<BrowserTabFacts> => {
  const index = facts.findIndex((fact) => fact.id === told.id);
  if (index < 0) {
    return [...facts, told];
  }
  return facts.map((fact) => (fact.id === told.id ? told : fact));
};
