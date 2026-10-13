// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PortRow } from '@goodboy/core';
import { monitoringSignal } from './monitoringSignal';

type RowOfParams = {
  readonly port: number;
  readonly state: PortRow['state'];
};
const rowOf = ({ port, state }: RowOfParams) =>
  ({
    key: `${port}`,
    port,
    address: null,
    pid: null,
    processName: null,
    state,
    owner: null,
    projectId: null,
    label: null,
    source: null,
    isWatched: false,
  }) satisfies PortRow;

describe('monitoringSignal', () => {
  it('counts listening ports among the pinned and the ones Goodboy started', () => {
    expect(
      monitoringSignal({
        split: {
          pinned: [rowOf({ port: 5005, state: 'listening' })],
          goodboy: [
            rowOf({ port: 4300, state: 'listening' }),
            rowOf({ port: 4301, state: 'free' }),
          ],
        },
      }),
    ).toEqual({ inUse: 2, hasDownPin: false });
  });

  it('counts a port once when two listeners share it', () => {
    expect(
      monitoringSignal({
        split: {
          pinned: [rowOf({ port: 4300, state: 'listening' })],
          goodboy: [rowOf({ port: 4300, state: 'listening' })],
        },
      }).inUse,
    ).toBe(1);
  });

  it('flags a pinned port that is down', () => {
    expect(
      monitoringSignal({
        split: { pinned: [rowOf({ port: 9000, state: 'free' })], goodboy: [] },
      }),
    ).toEqual({ inUse: 0, hasDownPin: true });
  });
});
