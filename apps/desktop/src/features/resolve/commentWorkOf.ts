import type { AgentId, ResolveAttempt } from '@goodboy/types';
import type { ResolveWord } from './commentProjection';
import { queuedPlaceText } from './reviewLaunchCopy';

export type CommentWork = {
  readonly state: 'fixing' | 'queued';
  readonly detail: string | null;
  readonly agentId: AgentId | null;
  readonly batchSize: number;
};

type WorkEntry = {
  readonly threadId: string;
  readonly resolveWord: ResolveWord;
  readonly isQueued: boolean;
  readonly row: { readonly attempt: Pick<ResolveAttempt, 'agentId' | 'createdAt'> | null };
};

type Params = {
  readonly entries: ReadonlyArray<WorkEntry>;
  readonly runThreadIds: ReadonlyArray<string>;
  readonly runAgentId: AgentId | null;
};

type QueueParams = {
  readonly entry: WorkEntry;
};

const queueAtOf = ({ entry }: QueueParams): number =>
  entry.row.attempt?.createdAt ?? Number.POSITIVE_INFINITY;

export const commentWorkOf = ({
  entries,
  runThreadIds,
  runAgentId,
}: Params): ReadonlyMap<string, CommentWork> => {
  const working = entries.filter((entry) => entry.resolveWord === 'working');
  const inRun = new Set(runThreadIds);
  const order = new Map(runThreadIds.map((threadId, index) => [threadId, index]));
  const fixingInRun = working.filter(
    (entry) => !entry.isQueued && inRun.has(entry.threadId),
  ).length;
  const queue = working
    .filter((entry) => entry.isQueued && inRun.has(entry.threadId))
    .sort(
      (left, right) =>
        queueAtOf({ entry: left }) - queueAtOf({ entry: right }) ||
        (order.get(left.threadId) ?? 0) - (order.get(right.threadId) ?? 0),
    );
  const places = new Map(queue.map((entry, index) => [entry.threadId, fixingInRun + index + 1]));
  return new Map(
    working.map((entry): [string, CommentWork] => {
      const ownAgentId = entry.row.attempt?.agentId ?? null;
      const isInRun = inRun.has(entry.threadId);
      const runAgent = isInRun ? runAgentId : null;
      const batchSize = isInRun ? runThreadIds.length : 1;
      if (!entry.isQueued) {
        return [
          entry.threadId,
          { state: 'fixing', detail: null, agentId: ownAgentId ?? runAgent, batchSize },
        ];
      }
      const place = places.get(entry.threadId) ?? null;
      return [
        entry.threadId,
        {
          state: 'queued',
          detail: place === null ? null : queuedPlaceText({ place }),
          agentId: runAgent ?? ownAgentId,
          batchSize,
        },
      ];
    }),
  );
};
