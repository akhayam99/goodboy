import { describe, expect, it } from 'vitest';
import type { PortRow } from '@goodboy/core';
import { groupPortRows } from './groupPortRows';
import { portListText } from './portListText';

type RowParams = {
  readonly port: number;
  readonly pid: number | null;
  readonly state?: PortRow['state'];
};

const rowOf = ({ port, pid, state = 'listening' }: RowParams): PortRow => ({
  key: `row:${port}:${pid ?? 'free'}`,
  port,
  address: null,
  pid,
  processName: pid === null ? null : 'com.docker.backend',
  state,
  owner: null,
  projectId: null,
  label: null,
  source: null,
  isWatched: false,
});

describe('groupPortRows', () => {
  it('collapses ports held by one pid into one shared item sorted by port', () => {
    const { inUse } = groupPortRows({
      rows: [
        rowOf({ port: 3030, pid: 31740 }),
        rowOf({ port: 80, pid: 31740 }),
        rowOf({ port: 4001, pid: 32803 }),
        rowOf({ port: 2019, pid: 31740 }),
      ],
    });

    expect(inUse.map((item) => item.kind)).toEqual(['shared', 'single']);
    const shared = inUse[0];
    expect(shared?.kind === 'shared' ? shared.rows.map((row) => row.port) : []).toEqual([
      80, 2019, 3030,
    ]);
  });

  it('keeps one port on two addresses as separate single rows', () => {
    const { inUse } = groupPortRows({
      rows: [rowOf({ port: 80, pid: 10 }), rowOf({ port: 80, pid: 10 })],
    });

    expect(inUse.map((item) => item.kind)).toEqual(['single', 'single']);
  });

  it('puts in-use rows before free rows and keeps free rows apart', () => {
    const { inUse, free } = groupPortRows({
      rows: [
        rowOf({ port: 5001, pid: null, state: 'free' }),
        rowOf({ port: 4001, pid: 7 }),
        rowOf({ port: 5002, pid: null, state: 'free' }),
      ],
    });

    expect(inUse).toHaveLength(1);
    expect(free.map((row) => row.port)).toEqual([5001, 5002]);
  });
});

describe('portListText', () => {
  it('lists ports and counts the rest', () => {
    expect(portListText({ ports: [3030, 80, 2019, 3031, 3306, 4222], max: 3 })).toBe(
      ':80 :2019 :3030 +3',
    );
  });

  it('lists every port when they fit', () => {
    expect(portListText({ ports: [5002, 5001], max: 6 })).toBe(':5001 :5002');
  });
});
