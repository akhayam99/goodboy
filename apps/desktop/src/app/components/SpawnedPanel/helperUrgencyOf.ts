import type { Tone, WorkNodeState } from '@goodboy/ui';
import type { SpawnedRow } from './spawnedRow';

export type HelperUrgency = Readonly<{
  word: string;
  tone: Tone;
  isNeedsYou: boolean;
}>;

type Params = {
  readonly rows: ReadonlyArray<SpawnedRow>;
};

type RankParams = {
  readonly node: WorkNodeState;
};

const NEEDS_YOU_NODES: ReadonlySet<WorkNodeState> = new Set<WorkNodeState>([
  'question',
  'approval',
  'alert',
  'budget',
]);

const NEEDS_YOU_RANK = 3;
const FAILED_RANK = 2;
const RUNNING_RANK = 1;

const urgencyRankOf = ({ node }: RankParams): number => {
  if (NEEDS_YOU_NODES.has(node)) {
    return NEEDS_YOU_RANK;
  }
  if (node === 'failed') {
    return FAILED_RANK;
  }
  return node === 'running' ? RUNNING_RANK : 0;
};

const TONE_BY_RANK: Readonly<Record<number, Tone>> = {
  [NEEDS_YOU_RANK]: 'warning',
  [FAILED_RANK]: 'danger',
  [RUNNING_RANK]: 'info',
};

export const helperUrgencyOf = ({ rows }: Params): HelperUrgency | null => {
  let bestRank = 0;
  let best: SpawnedRow | null = null;
  for (const row of rows) {
    const rank = urgencyRankOf({ node: row.node });
    if (rank > bestRank) {
      bestRank = rank;
      best = row;
    }
  }
  if (best === null) {
    return null;
  }
  return {
    word: best.word,
    tone: TONE_BY_RANK[bestRank] ?? 'neutral',
    isNeedsYou: bestRank === NEEDS_YOU_RANK,
  };
};
