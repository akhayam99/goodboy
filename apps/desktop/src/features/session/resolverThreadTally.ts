import type { ResolverThreadSettlement } from './resolverThreadSettlements';

export type ResolverThreadTally = {
  readonly total: number;
  readonly resolved: number;
  readonly wontfix: number;
  readonly analyzed: number;
  readonly open: number;
  readonly closed: number;
  readonly settled: number;
  readonly closable: number;
  readonly pushable: number;
  readonly isMixed: boolean;
};

type Countable = Pick<ResolverThreadSettlement, 'kind' | 'isClosed'>;

type Params = {
  readonly settlements: ReadonlyArray<Countable>;
};

export const resolverThreadTally = ({ settlements }: Params): ResolverThreadTally => {
  const countOf = (kind: ResolverThreadSettlement['kind']) =>
    settlements.filter((settlement) => settlement.kind === kind).length;
  const resolved = countOf('resolved');
  const wontfix = countOf('wontfix');
  const analyzed = countOf('analyzed');
  const open = settlements.filter(
    (settlement) => settlement.kind === 'open' && !settlement.isClosed,
  ).length;
  const closed = settlements.filter(
    (settlement) => settlement.kind === 'open' && settlement.isClosed,
  ).length;
  const buckets = [resolved, wontfix, analyzed, open].filter((count) => count > 0).length;
  return {
    total: settlements.length,
    resolved,
    wontfix,
    analyzed,
    open,
    closed,
    settled: resolved + wontfix + analyzed,
    closable: settlements.filter((settlement) => settlement.kind !== 'open' && !settlement.isClosed)
      .length,
    pushable: settlements.filter(
      (settlement) => settlement.kind === 'resolved' && !settlement.isClosed,
    ).length,
    isMixed: settlements.length > 1 && buckets > 1,
  };
};
