import { describe, expect, it } from 'vitest';
import type { MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import { mergePortSnapshot } from './mergePortSnapshot';

type ProcessOfParams = {
  readonly pid: number;
};
const processOf = ({ pid }: ProcessOfParams): MonitorProcess => ({
  pid,
  ppid: 1,
  pgid: pid,
  name: 'node',
  cwd: null,
  startedAt: 1,
  cpuPercent: 0,
  rssBytes: 1,
  uid: 501,
  argsMasked: 'node server.js',
});

type SnapshotOfParams = {
  readonly ports: ReadonlyArray<number>;
  readonly takenAt: number;
};

const snapshotOf = ({ ports, takenAt }: SnapshotOfParams): MonitorSnapshot => ({
  listeners: ports.map((port) => ({ port, address: '127.0.0.1', protocol: 'tcp', pid: port })),
  processes: ports.map((port) => processOf({ pid: port })),
  takenAt,
  isPlatformSupported: true,
});

describe('mergePortSnapshot', () => {
  it('takes the narrow snapshot as is when nothing is known yet', () => {
    const narrow = snapshotOf({ ports: [4300], takenAt: 10 });

    expect(mergePortSnapshot({ known: null, narrow, ports: [4300] })).toBe(narrow);
  });

  it('replaces the listeners of the scanned ports and keeps every other port', () => {
    const known = snapshotOf({ ports: [3000, 4300, 9000], takenAt: 1 });
    const narrow = snapshotOf({ ports: [4300], takenAt: 2 });

    const merged = mergePortSnapshot({ known, narrow, ports: [4300, 5005] });

    expect(merged.listeners.map((listener) => listener.port)).toEqual([3000, 4300, 9000]);
    expect(merged.takenAt).toBe(2);
  });

  it('drops a scanned port that stopped listening', () => {
    const known = snapshotOf({ ports: [3000, 4300], takenAt: 1 });
    const narrow = snapshotOf({ ports: [], takenAt: 2 });

    const merged = mergePortSnapshot({ known, narrow, ports: [4300] });

    expect(merged.listeners.map((listener) => listener.port)).toEqual([3000]);
  });

  it('keeps each process once, the fresh read first', () => {
    const known = snapshotOf({ ports: [3000, 4300], takenAt: 1 });
    const narrow = snapshotOf({ ports: [4300], takenAt: 2 });

    const merged = mergePortSnapshot({ known, narrow, ports: [4300] });

    expect(merged.processes.map((process) => process.pid)).toEqual([4300, 3000]);
  });

  it('evicts a process that stopped listening on a scanned port', () => {
    const known = snapshotOf({ ports: [3000, 4300], takenAt: 1 });
    const narrow = snapshotOf({ ports: [], takenAt: 2 });

    const merged = mergePortSnapshot({ known, narrow, ports: [4300] });

    expect(merged.processes.map((process) => process.pid)).toEqual([3000]);
  });

  it('keeps a process that still listens outside the scanned ports', () => {
    const known: MonitorSnapshot = {
      ...snapshotOf({ ports: [4300], takenAt: 1 }),
      listeners: [
        { port: 4300, address: '127.0.0.1', protocol: 'tcp', pid: 77 },
        { port: 9000, address: '127.0.0.1', protocol: 'tcp', pid: 77 },
      ],
      processes: [processOf({ pid: 77 })],
    };
    const narrow = snapshotOf({ ports: [], takenAt: 2 });

    const merged = mergePortSnapshot({ known, narrow, ports: [4300] });

    expect(merged.processes.map((process) => process.pid)).toEqual([77]);
  });
});
