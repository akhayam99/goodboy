import { isProduction } from '../../isProduction';
import type { Fact, FactCardSpec } from './types';

export const MAX_FACTS = 6;

type Params = {
  readonly card: FactCardSpec;
};

export const cappedFacts = ({ card }: Params): ReadonlyArray<Fact> => {
  if (card.facts.length > MAX_FACTS && !isProduction()) {
    throw new Error(
      `FactCard "${card.title}" sent ${card.facts.length} facts, the cap is ${MAX_FACTS}. Two facts or more is a card; trim the rows or use a Tooltip for one sentence.`,
    );
  }
  return card.facts.slice(0, MAX_FACTS);
};
