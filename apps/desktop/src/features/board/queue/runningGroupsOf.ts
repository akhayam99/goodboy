import type { Work } from '../../live-state/workOf';
import type { PendingSend } from './QueueBoard/useQueueSends';

export type RunningRow = Readonly<{
  runId: string;
  agentId: string | null;
  sessionId: string;
  who: string;
  phrase: string;
  project: string | null;
  startedAt: number | null;
  queued: PendingSend['kind'] | null;
}>;

export type RunningGroup = Readonly<{
  sessionId: string;
  title: string;
  rows: ReadonlyArray<RunningRow>;
}>;

type Params = {
  readonly work: ReadonlyArray<Work>;
  readonly sessionTitles: ReadonlyMap<string, string>;
  readonly nounById: ReadonlyMap<string, string>;
  readonly pending: ReadonlyArray<PendingSend>;
};

const QUEUED_PHRASE: Record<PendingSend['kind'], string> = {
  answer: 'Answer queued',
  message: 'Message queued',
};

export const runningGroupsOf = ({
  work,
  sessionTitles,
  nounById,
  pending,
}: Params): ReadonlyArray<RunningGroup> => {
  const queuedByAgent = new Map(
    pending.flatMap((send) => (send.agentId === null ? [] : [[send.agentId, send.kind] as const])),
  );
  const groups = new Map<string, RunningRow[]>();
  for (const item of work) {
    if (item.sessionId === null) {
      continue;
    }
    const queued = item.agentId === null ? null : (queuedByAgent.get(item.agentId) ?? null);
    const row: RunningRow = {
      runId: item.runId,
      agentId: item.agentId,
      sessionId: item.sessionId,
      who: (item.agentId === null ? undefined : nounById.get(item.agentId)) ?? 'Agent',
      phrase: queued === null ? item.phrase : QUEUED_PHRASE[queued],
      project: item.place.kind === 'project' ? item.place.name : null,
      startedAt: item.startedAt,
      queued,
    };
    groups.set(item.sessionId, [...(groups.get(item.sessionId) ?? []), row]);
  }
  return [...groups.entries()].map(([sessionId, rows]) => ({
    sessionId,
    title: sessionTitles.get(sessionId) ?? '',
    rows,
  }));
};
