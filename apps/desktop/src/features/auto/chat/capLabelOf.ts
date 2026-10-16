import type { AutoBudgetFacts } from '@goodboy/core';
import { formatUsd } from '@goodboy/ui';

type Params = {
  readonly facts: AutoBudgetFacts;
};

export const capLabelOf = ({ facts }: Params): string =>
  facts.capUsd === null ? 'No limit' : `Limit ${formatUsd(facts.capUsd)}`;
