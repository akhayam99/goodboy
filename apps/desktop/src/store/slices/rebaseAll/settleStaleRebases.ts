import { brandId, type MountId, type SessionEvent, type SessionId } from '@goodboy/types';
import { rebaseStatusTargetsOf } from '../../../features/history/behindBranchesOf';
import { hasHistoryRecovery } from '../../../features/history/historyRecovery';
import { historyStopReasonOf } from '../../../features/history/historyStopReasonOf';
import { isRebaseRunStale } from '../../../features/history/isRebaseRunStale';
import { isRebaseStopRelevant } from '../../../features/history/isRebaseStopRelevant';
import { isRebaseStopSettled } from '../../../features/history/isRebaseStopSettled';
import type { HistoryRun, HistoryStopReason } from '../history/types';
import {
  readWorktreeStatusRead,
  type WorktreeStatusRead,
} from '../../runtime/worktreeStatuses/cache';
import { writeSettledStops } from './writeSettledStops';
import type { GetFn, RebaseAllBranch, RebaseAllRun, SetFn, SettleStaleRebasesInput } from './types';

type Reads = ReadonlyMap<string, WorktreeStatusRead>;

const NO_STOPS: ReadonlySet<string> = new Set();

const LINE_REASONS: ReadonlySet<HistoryStopReason> = new Set<HistoryStopReason>([
  'origin-moved',
  'push-failed',
]);

type RunHeadParams = {
  readonly run: HistoryRun | undefined;
};

const stopHeadOf = ({ run }: RunHeadParams): string | null =>
  run?.stop?.head ?? run?.rebaseConflict?.head ?? null;

type RunParams = {
  readonly run: HistoryRun;
  readonly sessionId: SessionId;
  readonly read: WorktreeStatusRead | undefined;
};

const isStaleRun = ({ run, sessionId, read }: RunParams): boolean =>
  run.sessionId === sessionId && isRebaseRunStale({ run, read });

type BatchParams = {
  readonly run: RebaseAllRun | undefined;
  readonly historyRuns: Readonly<Record<MountId, HistoryRun>>;
  readonly reads: Reads;
};

const settledBatchOf = ({ run, historyRuns, reads }: BatchParams): RebaseAllRun | null => {
  if (run === undefined || run.phase === 'running' || run.phase === 'handing') {
    return null;
  }
  let isChanged = false;
  const branches = run.branches.map((branch): RebaseAllBranch => {
    const read = reads.get(branch.mountId);
    if (
      read === undefined ||
      (branch.state !== 'conflict' && branch.state !== 'failed') ||
      read.readAt <= run.startedAt
    ) {
      return branch;
    }
    const history = historyRuns[branch.mountId];
    const head = history?.batchId === run.id ? stopHeadOf({ run: history }) : null;
    if (!isRebaseStopSettled({ status: read.status, head })) {
      return branch;
    }
    isChanged = true;
    return { ...branch, state: 'rebased', message: null };
  });
  return isChanged ? { ...run, branches } : null;
};

type EventParams = {
  readonly event: SessionEvent;
  readonly reads: Reads;
};

const isSettledStop = ({ event, reads }: EventParams): boolean => {
  const payload = event.payload;
  if (
    event.kind !== 'history_stopped' ||
    payload === null ||
    payload.origin !== 'rebase' ||
    payload.mountId === undefined
  ) {
    return false;
  }
  const read = reads.get(payload.mountId);
  return (
    read !== undefined &&
    read.readAt > Date.parse(event.createdAt) &&
    !isRebaseStopRelevant({
      reason: historyStopReasonOf({ reason: payload.reason }),
      head: payload.head ?? null,
      status: read.status,
    })
  );
};

type PresentParams = {
  readonly known: ReadonlySet<string>;
  readonly events: ReadonlyArray<SessionEvent>;
};

const stillPresent = ({ known, events }: PresentParams): ReadonlyArray<string> => {
  const present = new Set<string>(events.map((event) => event.id));
  return [...known].filter((id) => present.has(id));
};

type LineParams = {
  readonly staleRuns: ReadonlyArray<HistoryRun>;
  readonly freshEvents: ReadonlyArray<SessionEvent>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly known: ReadonlySet<string>;
};

const lineMountsOf = ({ staleRuns, freshEvents, events, known }: LineParams): Set<MountId> => {
  const mounts = new Set<MountId>();
  for (const run of staleRuns) {
    if (run.stop !== null && LINE_REASONS.has(run.stop.reason)) {
      mounts.add(run.mountId);
    }
  }
  for (const event of freshEvents) {
    const mountId = event.payload?.mountId;
    if (
      mountId !== undefined &&
      LINE_REASONS.has(historyStopReasonOf({ reason: event.payload?.reason })) &&
      hasHistoryRecovery({ event, events, settledStopIds: known })
    ) {
      mounts.add(brandId<MountId>({ value: mountId }));
    }
  }
  return mounts;
};

export const settleStaleRebases = (set: SetFn, get: GetFn) => {
  return ({ sessionId }: SettleStaleRebasesInput): void => {
    const state = get();
    const reads = new Map<string, WorktreeStatusRead>();
    for (const target of rebaseStatusTargetsOf({
      mounts: state.sessionProjectMounts[sessionId] ?? [],
      projects: state.projects,
    })) {
      const read = readWorktreeStatusRead({ key: target.key });
      if (read !== null) {
        reads.set(target.mountId, read);
      }
    }
    if (reads.size === 0) {
      return;
    }
    const before = state.settledRebaseStops;
    set((current) => {
      const staleRuns = Object.values(current.historyRuns).filter((run) =>
        isStaleRun({ run, sessionId, read: reads.get(run.mountId) }),
      );
      const staleMounts = new Set(staleRuns.map((run) => run.mountId));
      const batch = settledBatchOf({
        run: current.rebaseAllRuns[sessionId],
        historyRuns: current.historyRuns,
        reads,
      });
      const known = new Set(current.settledRebaseStops[sessionId] ?? NO_STOPS);
      const events = current.sessionEvents?.[sessionId] ?? [];
      const freshEvents = events.filter(
        (event) => !known.has(event.id) && isSettledStop({ event, reads }),
      );
      if (staleMounts.size === 0 && batch === null && freshEvents.length === 0) {
        return current;
      }
      const historyRuns: Record<MountId, HistoryRun> = {};
      for (const run of Object.values(current.historyRuns)) {
        if (!staleMounts.has(run.mountId)) {
          historyRuns[run.mountId] = run;
        }
      }
      const lineMounts = lineMountsOf({ staleRuns, freshEvents, events, known });
      const now = Date.now();
      const rebaseSettleLines: Record<MountId, number> = { ...current.rebaseSettleLines };
      for (const mountId of lineMounts) {
        rebaseSettleLines[mountId] = now;
      }
      return {
        ...(staleMounts.size > 0 && { historyRuns }),
        ...(lineMounts.size > 0 && { rebaseSettleLines }),
        ...(batch !== null && {
          rebaseAllRuns: { ...current.rebaseAllRuns, [sessionId]: batch },
        }),
        ...(freshEvents.length > 0 && {
          settledRebaseStops: {
            ...current.settledRebaseStops,
            [sessionId]: [
              ...stillPresent({ known, events }),
              ...freshEvents.map((event) => event.id),
            ],
          },
        }),
      };
    });
    const after = get().settledRebaseStops;
    if (after !== before) {
      writeSettledStops({ stops: after });
    }
  };
};
