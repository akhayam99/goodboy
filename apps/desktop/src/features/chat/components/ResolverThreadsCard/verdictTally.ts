import type { ResolverThreadVerdictKind } from './resolverThreadVerdicts';
import { resolverOutcome, type ResolverOutcome } from './resolverOutcome';

export type VerdictTally = {
  readonly total: number;
  readonly counts: Readonly<Record<ResolverOutcome, number>>;
};

type Countable = {
  readonly kind: ResolverThreadVerdictKind;
  readonly isClosed: boolean;
};

type Params = {
  readonly verdicts: ReadonlyArray<Countable>;
};

export const verdictTally = ({ verdicts }: Params): VerdictTally => {
  const outcomes = verdicts.map((verdict) =>
    resolverOutcome({ kind: verdict.kind, isClosed: verdict.isClosed }),
  );
  const countOf = ({ outcome }: { readonly outcome: ResolverOutcome }): number =>
    outcomes.filter((entry) => entry === outcome).length;
  return {
    total: verdicts.length,
    counts: {
      fixed: countOf({ outcome: 'fixed' }),
      no_change: countOf({ outcome: 'no_change' }),
      explained: countOf({ outcome: 'explained' }),
      closed: countOf({ outcome: 'closed' }),
      needs_you: countOf({ outcome: 'needs_you' }),
    },
  };
};
