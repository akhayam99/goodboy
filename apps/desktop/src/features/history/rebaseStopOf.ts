import type {
  MountId,
  SessionEvent,
  SessionEventId,
  SessionId,
  WorktreeStatus,
} from '@goodboy/types';
import type { HistoryRun, HistoryStopReason } from '../../store/slices/history/types';
import type { WorktreeStatusRead } from '../../store/runtime/worktreeStatuses/cache';
import { hasHistoryRecovery } from './historyRecovery';
import { isRebaseStopSettled } from './isRebaseStopSettled';

export type RebaseStop = {
  readonly run: HistoryRun;
  readonly eventId: SessionEventId | null;
  readonly isRebuilt: boolean;
  readonly status: WorktreeStatus | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly run: HistoryRun | null | undefined;
  readonly events: ReadonlyArray<SessionEvent> | undefined;
  readonly settledStopIds: ReadonlyArray<string> | undefined;
  readonly baseBranch: string;
  readonly read: WorktreeStatusRead | null;
};

const STOP_REASONS: ReadonlyArray<HistoryStopReason> = [
  'conflict',
  'hook',
  'stuck',
  'invalid',
  'unverified',
  'origin-moved',
  'head-moved',
  'blocked',
  'dirty',
  'no-provider',
  'push-failed',
  'failed',
];

const SETTLED_BY_GIT: ReadonlySet<HistoryStopReason> = new Set<HistoryStopReason>([
  'conflict',
  'hook',
  'failed',
]);

type ReasonParams = {
  readonly reason: string | undefined;
};

const reasonOf = ({ reason }: ReasonParams): HistoryStopReason =>
  STOP_REASONS.find((known) => known === reason) ?? 'failed';

type EventParams = {
  readonly event: SessionEvent;
};

const atOf = ({ event }: EventParams): number => Date.parse(event.createdAt);

type LatestParams = {
  readonly mountId: MountId;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly settled: ReadonlySet<string>;
};

const latestOpenStopOf = ({ mountId, events, settled }: LatestParams): SessionEvent | null =>
  events
    .filter(
      (event) =>
        event.kind === 'history_stopped' &&
        event.payload?.origin === 'rebase' &&
        event.payload.mountId === mountId &&
        hasHistoryRecovery({ event, events, settledStopIds: settled }),
    )
    .reduce<SessionEvent | null>(
      (latest, event) =>
        latest === null || atOf({ event }) > atOf({ event: latest }) ? event : latest,
      null,
    );

type RebuildParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly event: SessionEvent;
  readonly baseBranch: string;
};

const runOfEvent = ({ sessionId, mountId, event, baseBranch }: RebuildParams): HistoryRun => {
  const payload = event.payload;
  const reason = reasonOf({ reason: payload?.reason });
  const head = payload?.head ?? null;
  return {
    sessionId,
    mountId,
    origin: 'rebase',
    phase: 'stopped',
    planId: null,
    agentId: null,
    copyPath: null,
    stop: {
      reason,
      message: payload?.title ?? '',
      files: payload?.files ?? [],
      sha: null,
      ...(head !== null && { head }),
    },
    result: null,
    backupRef: payload?.backupRef ?? null,
    remoteSha: null,
    holder: null,
    progress: null,
    applied: null,
    identity: null,
    movedHead: null,
    threadShas: [],
    commitCount: null,
    batchId: payload?.batchId ?? null,
    ...((reason === 'conflict' || reason === 'hook') && {
      rebaseConflict: { ontoRef: null, baseBranch, head, autoAgentId: null },
    }),
    updatedAt: atOf({ event }),
  };
};

export const rebaseStopOf = ({
  sessionId,
  mountId,
  run,
  events,
  settledStopIds,
  baseBranch,
  read,
}: Params): RebaseStop | null => {
  if (run !== null && run !== undefined) {
    return { run, eventId: null, isRebuilt: false, status: read?.status ?? null };
  }
  const event = latestOpenStopOf({
    mountId,
    events: events ?? [],
    settled: new Set(settledStopIds ?? []),
  });
  if (event === null) {
    return null;
  }
  const rebuilt = runOfEvent({ sessionId, mountId, event, baseBranch });
  const fresh = read !== null && read.readAt > rebuilt.updatedAt ? read.status : null;
  const reason = rebuilt.stop?.reason;
  if (
    fresh !== null &&
    reason !== undefined &&
    SETTLED_BY_GIT.has(reason) &&
    isRebaseStopSettled({ status: fresh, head: rebuilt.stop?.head ?? null })
  ) {
    return null;
  }
  return { run: rebuilt, eventId: event.id, isRebuilt: true, status: fresh };
};
