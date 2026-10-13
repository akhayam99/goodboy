import { describe, expect, it } from 'vitest';
import type { PortRow } from '@goodboy/core';
import { signalPorts } from './signalPorts';

type RowParams = {
  readonly port: number;
};

const rowOn = ({ port }: RowParams) =>
  ({
    key: `${port}`,
    port,
    address: null,
    pid: null,
    processName: null,
    state: 'listening',
    owner: null,
    projectId: null,
    label: null,
    source: null,
    isWatched: false,
  }) satisfies PortRow;

describe('signalPorts', () => {
  it('lists pinned, learned and Goodboy-run ports once, sorted', () => {
    const ports = signalPorts({
      split: { goodboy: [rowOn({ port: 4300 }), rowOn({ port: 5173 })] },
      pinned: [{ port: 9000, description: 'Mock API' }],
      learned: { Harborline: [5173, 3000], Northwind: [3000] },
    });

    expect(ports).toEqual([3000, 4300, 5173, 9000]);
  });

  it('is empty when the user owns no port', () => {
    expect(signalPorts({ split: { goodboy: [] }, pinned: [], learned: {} })).toEqual([]);
  });
});
