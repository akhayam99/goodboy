import { describe, expect, it } from 'vitest';
import type { MonitorSnapshot, PortRow } from '@goodboy/core';
import { filterPortRows } from './filterPortRows';
import { formatMemory } from './formatMemory';
import { portSummary } from './portSummary';
import { portsOfProcessTree } from './portsOfProcessTree';

type RowParams = {
  readonly port: number;
  readonly state?: PortRow['state'];
  readonly isWatched?: boolean;
  readonly projectId?: string | null;
  readonly label?: string | null;
};

const rowOf = ({
  port,
  state = 'listening',
  isWatched = false,
  projectId = null,
  label = null,
}: RowParams) =>
  ({
    key: `${port}`,
    port,
    address: null,
    pid: null,
    processName: null,
    state,
    owner: null,
    projectId,
    label,
    source: null,
    isWatched,
  }) satisfies PortRow;

describe('filterPortRows', () => {
  const rows = [
    rowOf({ port: 5005, projectId: 'p1' }),
    rowOf({ port: 3000, projectId: 'p2', label: 'Storybook' }),
  ];
  const projectNameOf = (id: string | null) => (id === 'p1' ? 'payments-api' : 'ledger-core');

  it.each([
    ['', 2],
    ['   ', 2],
    ['5005', 1],
    [':5005', 1],
    ['LEDGER', 1],
    ['storybook', 1],
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

  it('finds a port held by a nested job: shell, npm, sh, node', () => {
    const chain = [
      { pid: 200, ppid: 1, name: 'zsh' },
      { pid: 201, ppid: 200, name: 'npm' },
      { pid: 202, ppid: 201, name: 'sh' },
      { pid: 203, ppid: 202, name: 'node' },
    ];
    const nested: MonitorSnapshot = {
      ...snapshot,
      listeners: [{ port: 3000, address: '127.0.0.1', protocol: 'tcp', pid: 203 }],
      processes: chain.map((entry) => ({
        ...entry,
        pgid: entry.pid,
        cwd: null,
        startedAt: 0,
        cpuPercent: 0,
        rssBytes: 0,
        uid: 501,
        argsMasked: '',
      })),
    };

    expect(portsOfProcessTree({ snapshot: nested, rootPid: 200 })).toEqual([3000]);
    expect(portsOfProcessTree({ snapshot: nested, rootPid: 202 })).toEqual([3000]);
    expect(portsOfProcessTree({ snapshot: nested, rootPid: 203 })).toEqual([3000]);
  });

  it('returns nothing without a snapshot or for an unrelated root', () => {
    expect(portsOfProcessTree({ snapshot: null, rootPid: 10 })).toEqual([]);
    expect(portsOfProcessTree({ snapshot, rootPid: 500 })).toEqual([]);
  });
});
