import type { TurnBucket } from '@goodboy/db';

export type TurnStats = {
  readonly agents: number;
  readonly median: number;
  readonly p90: number;
  readonly maxAgents: number;
};

type Params = {
  readonly buckets: ReadonlyArray<TurnBucket>;
};

export const turnStats = ({ buckets }: Params): TurnStats | null => {
  const agents = buckets.reduce((sum, bucket) => sum + bucket.agentCount, 0);
  if (agents === 0) {
    return null;
  }

  const medianRank = Math.ceil(agents * 0.5);
  const p90Rank = Math.ceil(agents * 0.9);
  let seen = 0;
  let median: number | null = null;
  let p90: number | null = null;
  let maxAgents = 0;

  for (const bucket of buckets) {
    seen += bucket.agentCount;
    if (median === null && seen >= medianRank) {
      median = bucket.turnCount;
    }
    if (p90 === null && seen >= p90Rank) {
      p90 = bucket.turnCount;
    }
    if (bucket.agentCount > maxAgents) {
      maxAgents = bucket.agentCount;
    }
  }

  const resolvedMedian = median ?? 0;
  return {
    agents,
    median: resolvedMedian,
    p90: p90 ?? resolvedMedian,
    maxAgents,
  };
};
