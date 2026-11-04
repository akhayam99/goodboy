import type { RailBranchFacts } from './railBranchFactsOf';

type Params = {
  readonly facts: RailBranchFacts;
  readonly reason: string | null;
};

export const railBranchLabelOf = ({ facts, reason }: Params): string =>
  [...facts.parts, reason]
    .filter((part): part is string => part !== null && part !== '')
    .join(', ');
