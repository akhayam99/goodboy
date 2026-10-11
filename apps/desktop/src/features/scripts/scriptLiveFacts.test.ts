// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import { scriptLiveFacts } from './scriptLiveFacts';

const processOf = (
  overrides: Pick<MonitorProcess, 'pid' | 'ppid' | 'pgid' | 'cpuPercent' | 'rssBytes'>,
): MonitorProcess => ({
  ...overrides,
  name: 'node',
  cwd: null,
  startedAt: 0,
  uid: 501,
  argsMasked: 'node',
});

const SNAPSHOT: MonitorSnapshot = {
  listeners: [
    { port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 11 },
    { port: 9229, address: '127.0.0.1', protocol: 'tcp', pid: 12 },
    { port: 3000, address: '127.0.0.1', protocol: 'tcp', pid: 90 },
  ],
  processes: [
    processOf({ pid: 10, ppid: 1, pgid: 10, cpuPercent: 1, rssBytes: 100 }),
    processOf({ pid: 11, ppid: 10, pgid: 10, cpuPercent: 4, rssBytes: 200 }),
    processOf({ pid: 12, ppid: 11, pgid: 12, cpuPercent: 2, rssBytes: 300 }),
    processOf({ pid: 90, ppid: 1, pgid: 90, cpuPercent: 50, rssBytes: 999 }),
  ],
  takenAt: 1,
  isPlatformSupported: true,
};

describe('scriptLiveFacts', () => {
  it('sums the run tree and lists the ports its processes own, sorted', () => {
    expect(scriptLiveFacts({ snapshot: SNAPSHOT, pid: 10 })).toEqual({
      pid: 10,
      ports: [5005, 9229],
      cpuPercent: 7,
      rssBytes: 600,
    });
  });

  it('is empty for a pid the snapshot does not know', () => {
    expect(scriptLiveFacts({ snapshot: SNAPSHOT, pid: 77 })).toEqual({
      pid: 77,
      ports: [],
      cpuPercent: 0,
      rssBytes: 0,
    });
  });

  it('is empty before the first snapshot', () => {
    expect(scriptLiveFacts({ snapshot: null, pid: 10 }).ports).toEqual([]);
  });
});
