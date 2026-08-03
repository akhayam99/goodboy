import type { ResolverThreadSettlement } from './resolverThreadSettlements';

export type ResolverThreadTally = {
  readonly total: number;
  readonly resolved: number;
  readonly wontfix: number;
  readonly analyzed: number;
  readonly open: number;
  readonly settled: number;
  readonly isMixed: boolean;
};

type Params = {
  readonly settlements: ReadonlyArray<ResolverThreadSettlement>;
};

export const resolverThreadTally = ({ settlements }: Params): ResolverThreadTally => {
  const countOf = (kind: ResolverThreadSettlement['kind']) =>
    settlements.filter((settlement) => settlement.kind === kind).length;
  const resolved = countOf('resolved');
  const wontfix = countOf('wontfix');
  const analyzed = countOf('analyzed');
  const open = countOf('open');
  const buckets = [resolved, wontfix, analyzed, open].filter((count) => count > 0).length;
  return {
    total: settlements.length,
    resolved,
    wontfix,
    analyzed,
    open,
    settled: resolved + wontfix + analyzed,
    isMixed: settlements.length > 1 && buckets > 1,
  };
};
