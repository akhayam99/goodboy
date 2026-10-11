import type { LedgerKind, MonitorSnapshot } from '@goodboy/core';

const STUCK_AFTER_MS = 2 * 60 * 60 * 1000;
const STUCK_SNAPSHOTS = 3;
const IDLE_CPU_PERCENT = 0.1;
const STUCK_KINDS: ReadonlyArray<LedgerKind> = ['turn', 'chat', 'planner', 'summary'];

type NextParams = {
  readonly previous: ReadonlyMap<number, number>;
  readonly snapshot: MonitorSnapshot;
};

export const nextIdleCounts = ({ previous, snapshot }: NextParams): ReadonlyMap<number, number> => {
  const next = new Map<number, number>();
  for (const process of snapshot.processes) {
    if (process.cpuPercent < IDLE_CPU_PERCENT) {
      next.set(process.pid, (previous.get(process.pid) ?? 0) + 1);
    }
  }
  return next;
};

type StuckParams = {
  readonly kind: LedgerKind;
  readonly pid: number;
  readonly startedAt: number;
  readonly now: number;
  readonly idleCounts: ReadonlyMap<number, number>;
};

export const isStuck = ({ kind, pid, startedAt, now, idleCounts }: StuckParams): boolean =>
  STUCK_KINDS.includes(kind) &&
  now - startedAt > STUCK_AFTER_MS &&
  (idleCounts.get(pid) ?? 0) >= STUCK_SNAPSHOTS;
