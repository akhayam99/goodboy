import { describe, expect, it } from 'vitest';
import type { MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import { STUCK_AFTER_MS, isStuck, nextIdleCounts } from './stuckProcesses';

const processOf = ({ pid, cpuPercent }: { readonly pid: number; readonly cpuPercent: number }) =>
  ({
    pid,
    ppid: 1,
    pgid: pid,
    name: 'claude',
    cwd: null,
    startedAt: 0,
    cpuPercent,
    rssBytes: 0,
    uid: 501,
    argsMasked: '',
  }) satisfies MonitorProcess;

const snapshotOf = ({ cpu }: { readonly cpu: number }): MonitorSnapshot => ({
  listeners: [],
  processes: [processOf({ pid: 7, cpuPercent: cpu })],
  takenAt: 1,
  isPlatformSupported: true,
});

const repeated = ({ cpu, times }: { readonly cpu: number; readonly times: number }) => {
  let counts: ReadonlyMap<number, number> = new Map();
  for (let index = 0; index < times; index += 1) {
    counts = nextIdleCounts({ previous: counts, snapshot: snapshotOf({ cpu }) });
  }
  return counts;
};

describe('stuck processes', () => {
  it('counts consecutive idle snapshots and resets on any CPU', () => {
    expect(repeated({ cpu: 0, times: 3 }).get(7)).toBe(3);
    const busy = nextIdleCounts({
      previous: repeated({ cpu: 0, times: 3 }),
      snapshot: snapshotOf({ cpu: 4 }),
    });
    expect(busy.get(7)).toBeUndefined();
  });

  it('flags an agent idle for 3 snapshots and over 2 hours', () => {
    const idleCounts = repeated({ cpu: 0, times: 3 });

    expect(
      isStuck({ kind: 'turn', pid: 7, startedAt: 0, now: STUCK_AFTER_MS + 1, idleCounts }),
    ).toBe(true);
  });

  it('does not flag a young run, too few snapshots, or a script', () => {
    const idleCounts = repeated({ cpu: 0, times: 3 });

    expect(isStuck({ kind: 'turn', pid: 7, startedAt: 0, now: STUCK_AFTER_MS, idleCounts })).toBe(
      false,
    );
    expect(
      isStuck({
        kind: 'turn',
        pid: 7,
        startedAt: 0,
        now: STUCK_AFTER_MS + 1,
        idleCounts: repeated({ cpu: 0, times: 2 }),
      }),
    ).toBe(false);
    expect(
      isStuck({ kind: 'script', pid: 7, startedAt: 0, now: STUCK_AFTER_MS + 1, idleCounts }),
    ).toBe(false);
  });
});
