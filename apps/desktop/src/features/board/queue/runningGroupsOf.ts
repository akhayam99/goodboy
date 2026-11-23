import type { Work } from '../../live-state/workOf';
import type { PendingSend } from './QueueBoard/useQueueSends';

export type RunningRow = Readonly<{
  runId: string;
  agentId: string | null;
  sessionId: string;
  mountId: string | null;
  who: string;
  phrase: string;
  project: string | null;
  startedAt: number | null;
  isQueued: boolean;
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

const QUEUED_PHRASE = 'Message queued';

export const runningGroupsOf = ({
  work,
  sessionTitles,
  nounById,
  pending,
}: Params): ReadonlyArray<RunningGroup> => {
  const queuedAgents = new Set(pending.map((send) => send.agentId));
  const groups = new Map<string, RunningRow[]>();
  for (const item of work) {
    if (item.sessionId === null) {
      continue;
    }
    const isQueued = item.agentId !== null && queuedAgents.has(item.agentId);
    const row: RunningRow = {
      runId: item.runId,
      agentId: item.agentId,
      sessionId: item.sessionId,
      mountId: item.mountId,
      who: (item.agentId === null ? undefined : nounById.get(item.agentId)) ?? 'Agent',
      phrase: isQueued ? QUEUED_PHRASE : item.phrase,
      project: item.place.kind === 'project' ? item.place.name : null,
      startedAt: item.startedAt,
      isQueued,
    };
    groups.set(item.sessionId, [...(groups.get(item.sessionId) ?? []), row]);
  }
  return [...groups.entries()].map(([sessionId, rows]) => ({
    sessionId,
    title: sessionTitles.get(sessionId) ?? '',
    rows,
  }));
};
