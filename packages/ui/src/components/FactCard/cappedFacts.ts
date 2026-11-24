import { isProduction } from '../../isProduction';
import { cappedModels } from './cappedModels';
import type { Fact, FactCardSpec } from './types';

export const MAX_FACTS = 6;

type Params = {
  readonly card: FactCardSpec;
};

export const cappedFacts = ({ card }: Params): ReadonlyArray<Fact> => {
  const room = MAX_FACTS - cappedModels({ card }).length;
  if (card.facts.length > room && !isProduction()) {
    throw new Error(
      `FactCard "${card.title}" sent ${card.facts.length} facts beside its model lines, the cap is ${MAX_FACTS} rows. Two facts or more is a card; trim the rows or use a Tooltip for one sentence.`,
    );
  }
  return card.facts.slice(0, room);
};
