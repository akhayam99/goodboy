import type {
  TimelineAgentEntry,
  TimelineResolveBatchEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import type { ResolveActivityFacts } from './resolveActivity';
import { resolveBatchSummary, type ResolveBatchRef } from './resolveBatchSummary';

const RESOLVE_BATCH_MIN_MEMBERS = 2;

const resolveBatchEntryId = ({ batchId }: { readonly batchId: string }): string =>
  `batch:${batchId}`;

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly batchByAgentId: ReadonlyMap<string, ResolveBatchRef>;
  readonly factsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
  readonly expandedBatchIds: ReadonlySet<string>;
};

type Result = {
  readonly remaining: ReadonlyArray<TimelineTopLevelEntry>;
  readonly batches: ReadonlyArray<TimelineResolveBatchEntry>;
};

type Member = {
  readonly entry: TimelineAgentEntry;
  readonly facts: ResolveActivityFacts;
};

const compareNewestFirst = ({
  first,
  second,
}: {
  readonly first: TimelineAgentEntry;
  readonly second: TimelineAgentEntry;
}): number => {
  if (first.at != null && second.at != null && first.at !== second.at) {
    return second.at.localeCompare(first.at);
  }
  return second.ordinal - first.ordinal || first.id.localeCompare(second.id);
};

const earliestAt = ({ members }: { readonly members: ReadonlyArray<Member> }): string | null => {
  const times = members.flatMap((member) => (member.entry.at === null ? [] : [member.entry.at]));
  return times.length === 0 ? null : times.reduce((a, b) => (a <= b ? a : b));
};

export const groupResolveBatches = ({
  entries,
  batchByAgentId,
  factsByAgentId,
  expandedBatchIds,
}: Params): Result => {
  const membersByBatchId = new Map<string, Member[]>();
  const refByBatchId = new Map<string, ResolveBatchRef>();
  for (const entry of entries) {
    if (entry.kind !== 'agent') {
      continue;
    }
    const ref = batchByAgentId.get(entry.agent.id);
    const facts = factsByAgentId.get(entry.agent.id);
    if (ref === undefined || facts === undefined) {
      continue;
    }
    const members = membersByBatchId.get(ref.batchId) ?? [];
    members.push({ entry, facts });
    membersByBatchId.set(ref.batchId, members);
    refByBatchId.set(ref.batchId, ref);
  }

  const groupedIds = new Set<string>();
  const batches: TimelineResolveBatchEntry[] = [];
  for (const [batchId, members] of membersByBatchId) {
    const ref = refByBatchId.get(batchId);
    if (ref === undefined || members.length < RESOLVE_BATCH_MIN_MEMBERS) {
      continue;
    }
    const ordered = [...members].sort((first, second) =>
      compareNewestFirst({ first: first.entry, second: second.entry }),
    );
    const id = resolveBatchEntryId({ batchId });
    for (const member of ordered) {
      groupedIds.add(member.entry.id);
    }
    const facts = ordered.map((member) => member.facts);
    batches.push({
      kind: 'resolveBatch',
      id,
      at: earliestAt({ members: ordered }),
      batchId,
      origin: ref.origin ?? 'launch',
      retryCount: ordered.filter(
        (member) => batchByAgentId.get(member.entry.agent.id)?.isRetry === true,
      ).length,
      prNumber: ref.prNumber,
      children: ordered.map((member) => member.entry),
      facts,
      summary: resolveBatchSummary({ facts }),
      isExpanded: expandedBatchIds.has(id),
    });
  }

  return {
    remaining: entries.filter((entry) => entry.kind !== 'agent' || !groupedIds.has(entry.id)),
    batches,
  };
};
