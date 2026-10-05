import { resolveLabelOfState } from '../../resolve/commentProjection';
import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import type {
  TimelineAgentEntry,
  TimelineResolveFileEntry,
  TimelineResolveOpenEntry,
} from './buildTimelineGroups';
import type { ResolveActivityFacts, ResolveThreadFact } from './resolveActivity';

const NO_FILE_KEY = 'no-file';

const STATE_PRIORITY: ReadonlyArray<ReviewCommentState> = [
  'failed',
  'needs',
  'outdated',
  'ready',
  'edited',
  'drafting',
  'new',
  'accepted',
  'replied',
  'pushed',
  'resolved',
  'skipped',
];

type Member = {
  readonly entry: TimelineAgentEntry;
  readonly facts: ResolveActivityFacts;
};

type Bucket = {
  readonly path: string | null;
  readonly threads: Array<ResolveThreadFact>;
  readonly agentIds: Array<string>;
};

const threadsOf = ({ facts }: { readonly facts: ResolveActivityFacts }) =>
  facts.threads === undefined || facts.threads.length === 0
    ? [{ state: facts.state, path: null, line: null } satisfies ResolveThreadFact]
    : facts.threads;

const linesOf = ({
  threads,
}: {
  readonly threads: ReadonlyArray<ResolveThreadFact>;
}): ReadonlyArray<{ readonly line: number; readonly count: number }> => {
  const counts = new Map<number, number>();
  for (const thread of threads) {
    if (thread.line !== null) {
      counts.set(thread.line, (counts.get(thread.line) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([first], [second]) => first - second)
    .map(([line, count]) => ({ line, count }));
};

const dominantOf = ({
  threads,
}: {
  readonly threads: ReadonlyArray<ResolveThreadFact>;
}): { readonly state: ReviewCommentState; readonly count: number } => {
  const counts = new Map<ReviewCommentState, number>();
  for (const thread of threads) {
    counts.set(thread.state, (counts.get(thread.state) ?? 0) + 1);
  }
  const state = STATE_PRIORITY.find((candidate) => counts.has(candidate)) ?? 'new';
  return { state, count: counts.get(state) ?? 0 };
};

export const resolveBatchFiles = ({
  batchEntryId,
  prNumber,
  at,
  members,
}: {
  readonly batchEntryId: string;
  readonly prNumber: number | null;
  readonly at: string | null;
  readonly members: ReadonlyArray<Member>;
}): ReadonlyArray<TimelineResolveFileEntry> => {
  const buckets = new Map<string, Bucket>();
  for (const member of members) {
    const threads = threadsOf({ facts: member.facts });
    const first = threads[0];
    for (const thread of threads) {
      const key = thread.path ?? NO_FILE_KEY;
      const bucket = buckets.get(key) ?? { path: thread.path, threads: [], agentIds: [] };
      bucket.threads.push(thread);
      if (thread === first) {
        bucket.agentIds.push(member.entry.agent.id);
      }
      buckets.set(key, bucket);
    }
  }
  return [...buckets.entries()]
    .sort(([firstKey], [secondKey]) => {
      if (firstKey === NO_FILE_KEY) {
        return 1;
      }
      return secondKey === NO_FILE_KEY ? -1 : firstKey.localeCompare(secondKey);
    })
    .map(([key, bucket]) => {
      const { state, count } = dominantOf({ threads: bucket.threads });
      return {
        kind: 'resolveFile',
        id: `${batchEntryId}:file:${key}`,
        at,
        batchEntryId,
        prNumber,
        path: bucket.path,
        lines: linesOf({ threads: bucket.threads }),
        threadCount: bucket.threads.length,
        state,
        word:
          count > 1
            ? `${resolveLabelOfState({ state })} ×${count}`
            : resolveLabelOfState({ state }),
        agentIds: bucket.agentIds,
      } satisfies TimelineResolveFileEntry;
    });
};

export const resolveFileLinesText = ({
  lines,
}: {
  readonly lines: TimelineResolveFileEntry['lines'];
}): string =>
  lines.map(({ line, count }) => (count > 1 ? `:${line} ×${count}` : `:${line}`)).join(' · ');

export const resolveFileName = ({ path }: { readonly path: string | null }): string =>
  path === null ? 'Other comments' : (path.split('/').at(-1) ?? path);

export const resolveOpenLabel = ({ prNumber }: { readonly prNumber: number | null }): string =>
  prNumber === null ? 'Open the review' : `Open #${prNumber}`;

export const resolveBatchOpen = ({
  batchEntryId,
  prNumber,
  at,
}: {
  readonly batchEntryId: string;
  readonly prNumber: number | null;
  readonly at: string | null;
}): TimelineResolveOpenEntry => ({
  kind: 'resolveOpen',
  id: `${batchEntryId}:open`,
  at,
  batchEntryId,
  prNumber,
});
