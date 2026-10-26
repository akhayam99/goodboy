import type { MountId, SessionEvent, SessionId } from '@goodboy/types';
import { rebaseStatusTargetsOf } from '../../../features/history/behindBranchesOf';
import { isRebaseStopSettled } from '../../../features/history/isRebaseStopSettled';
import type { HistoryRun } from '../history/types';
import {
  readWorktreeStatusRead,
  type WorktreeStatusRead,
} from '../../runtime/worktreeStatuses/cache';
import type { GetFn, RebaseAllBranch, RebaseAllRun, SetFn, SettleStaleRebasesInput } from './types';

type Reads = ReadonlyMap<string, WorktreeStatusRead>;

const SETTLED_REASONS: ReadonlySet<string> = new Set(['conflict', 'hook', 'failed']);

const NO_STOPS: ReadonlySet<string> = new Set();

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
  read !== undefined &&
  run.sessionId === sessionId &&
  run.origin === 'rebase' &&
  run.phase === 'stopped' &&
  run.stop !== null &&
  SETTLED_REASONS.has(run.stop.reason) &&
  (run.rebaseConflict?.autoAgentId ?? null) === null &&
  run.rebaseConflict?.isHere !== true &&
  read.readAt > run.updatedAt &&
  isRebaseStopSettled({ status: read.status, head: stopHeadOf({ run }) });

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
    payload.mountId === undefined ||
    !SETTLED_REASONS.has(payload.reason ?? '')
  ) {
    return false;
  }
  const read = reads.get(payload.mountId);
  return (
    read !== undefined &&
    read.readAt > Date.parse(event.createdAt) &&
    isRebaseStopSettled({ status: read.status, head: payload.head ?? null })
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
    set((current) => {
      const staleMounts = Object.values(current.historyRuns)
        .filter((run) => isStaleRun({ run, sessionId, read: reads.get(run.mountId) }))
        .map((run) => run.mountId);
      const batch = settledBatchOf({
        run: current.rebaseAllRuns[sessionId],
        historyRuns: current.historyRuns,
        reads,
      });
      const known = new Set(current.settledRebaseStops[sessionId] ?? NO_STOPS);
      const events = current.sessionEvents?.[sessionId] ?? [];
      const fresh = events
        .filter((event) => !known.has(event.id) && isSettledStop({ event, reads }))
        .map((event) => event.id);
      if (staleMounts.length === 0 && batch === null && fresh.length === 0) {
        return current;
      }
      const historyRuns: Record<MountId, HistoryRun> = {};
      for (const run of Object.values(current.historyRuns)) {
        if (!staleMounts.includes(run.mountId)) {
          historyRuns[run.mountId] = run;
        }
      }
      return {
        ...(staleMounts.length > 0 && { historyRuns }),
        ...(batch !== null && {
          rebaseAllRuns: { ...current.rebaseAllRuns, [sessionId]: batch },
        }),
        ...(fresh.length > 0 && {
          settledRebaseStops: {
            ...current.settledRebaseStops,
            [sessionId]: [...stillPresent({ known, events }), ...fresh],
          },
        }),
      };
    });
  };
};
