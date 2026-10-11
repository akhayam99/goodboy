import { describe, expect, it } from 'vitest';
import type { MonitorSnapshot, PortRow } from '@goodboy/core';
import { filterPortRows } from './filterPortRows';
import { formatMemory } from './formatMemory';
import { portSummary } from './portSummary';
import { portsOfProcessTree } from './portsOfProcessTree';
import { splitPortRows } from './splitPortRows';
import { watchedPortSet } from './watchedPortSet';

type RowParams = {
  readonly port: number;
  readonly state?: PortRow['state'];
  readonly isWatched?: boolean;
  readonly projectId?: string | null;
};

const rowOf = ({ port, state = 'listening', isWatched = false, projectId = null }: RowParams) =>
  ({
    key: `${port}`,
    port,
    address: null,
    pid: null,
    processName: null,
    state,
    owner: null,
    projectId,
    label: null,
    isWatched,
  }) satisfies PortRow;

describe('splitPortRows', () => {
  it('keeps watched, free and watched-by-number rows in Ports and the rest in Also', () => {
    const rows = [
      rowOf({ port: 5005, isWatched: true }),
      rowOf({ port: 5002, state: 'free', isWatched: true }),
      rowOf({ port: 5006 }),
      rowOf({ port: 3000 }),
    ];

    const split = splitPortRows({ rows, watchedPorts: new Set([5006]) });

    expect(split.ports.map((row) => row.port)).toEqual([5005, 5002, 5006]);
    expect(split.also.map((row) => row.port)).toEqual([3000]);
  });

  it('returns two empty lists for no rows', () => {
    expect(splitPortRows({ rows: [], watchedPorts: new Set() })).toEqual({ ports: [], also: [] });
  });
});

describe('filterPortRows', () => {
  const rows = [rowOf({ port: 5005, projectId: 'p1' }), rowOf({ port: 3000, projectId: 'p2' })];
  const projectNameOf = (id: string | null) => (id === 'p1' ? 'payments-api' : 'ledger-core');

  it.each([
    ['', 2],
    ['   ', 2],
    ['5005', 1],
    [':5005', 1],
    ['LEDGER', 1],
    ['99999', 0],
  ])('narrows %j to %i row(s)', (query, count) => {
    expect(filterPortRows({ rows, query, projectNameOf })).toHaveLength(count);
  });
});

describe('portSummary', () => {
  it('counts listening rows against all watched rows', () => {
    const ports = [rowOf({ port: 1 }), rowOf({ port: 2, state: 'free' }), rowOf({ port: 3 })];

    expect(portSummary({ ports })).toEqual({ inUse: 2, total: 3 });
  });
});

describe('watchedPortSet', () => {
  it('merges scanned, watched and learned ports across projects', () => {
    const ports = watchedPortSet({
      scanned: { p1: [{ port: 5005, label: 'web', source: 'env' }] },
      watched: { p1: [5006] },
      learned: { p2: [3000] },
    });

    expect([...ports].sort()).toEqual([3000, 5005, 5006]);
  });
});

describe('formatMemory', () => {
  it.each([
    [512, '1 KB'],
    [5 * 1024 * 1024, '5 MB'],
    [3 * 1024 * 1024 * 1024, '3.0 GB'],
  ])('writes %i bytes as %s', (bytes, text) => {
    expect(formatMemory({ bytes })).toBe(text);
  });
});

describe('portsOfProcessTree', () => {
  const snapshot: MonitorSnapshot = {
    listeners: [
      { port: 5005, address: '*', protocol: 'tcp', pid: 12 },
      { port: 9000, address: '*', protocol: 'tcp', pid: 99 },
    ],
    processes: [10, 11, 12, 99].map((pid) => ({
      pid,
      ppid: pid === 99 ? 1 : pid - 1,
      pgid: pid,
      name: 'node',
      cwd: null,
      startedAt: 0,
      cpuPercent: 0,
      rssBytes: 0,
      uid: 501,
      argsMasked: '',
    })),
    takenAt: 0,
    isPlatformSupported: true,
  };

  it('finds ports listened on by any descendant of the root', () => {
    expect(portsOfProcessTree({ snapshot, rootPid: 10 })).toEqual([5005]);
  });

  it('returns nothing without a snapshot or for an unrelated root', () => {
    expect(portsOfProcessTree({ snapshot: null, rootPid: 10 })).toEqual([]);
    expect(portsOfProcessTree({ snapshot, rootPid: 500 })).toEqual([]);
  });
});
