import { RESOLVER_OUTCOME_LABEL, RESOLVER_OUTCOME_ORDER } from './resolverOutcome';
import type { VerdictTally } from './verdictTally';

type Params = {
  readonly tally: VerdictTally;
};

export const tallySentence = ({ tally }: Params): string | null => {
  if (tally.total < 2) {
    return null;
  }
  const parts = RESOLVER_OUTCOME_ORDER.flatMap((outcome) =>
    tally.counts[outcome] === 0
      ? []
      : [`${tally.counts[outcome]} ${RESOLVER_OUTCOME_LABEL[outcome]}`],
  );
  if (parts.length === 0) {
    return null;
  }
  return parts.join(' · ');
};
