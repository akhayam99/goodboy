// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { mergeOrderOf, type ReadyCar } from './mergeOrderOf';

const NOTIFY = brandId<ProjectId>({ value: 'notify-relay' });
const LEDGER = brandId<ProjectId>({ value: 'ledger-core' });

type CarParams = {
  readonly number: number;
  readonly projectId?: ProjectId;
  readonly branch?: string;
  readonly base?: string;
  readonly fileCount?: number | null;
};

const carOf = ({
  number,
  projectId = NOTIFY,
  branch = `acme/${number}`,
  base = 'main',
  fileCount = null,
}: CarParams): ReadyCar => ({
  sessionId: brandId<SessionId>({ value: `s-${number}` }),
  number,
  mountId: brandId<MountId>({ value: `m-${number}` }),
  projectId,
  repo: String(projectId),
  branch,
  base,
  fileCount,
});

const numbersOf = ({ cars }: { readonly cars: ReadonlyArray<ReadyCar> }) =>
  mergeOrderOf({ cars }).map(({ car, reason }) => [car.number, reason]);

describe('mergeOrderOf', () => {
  it('puts the smallest change first and says why', () => {
    expect(
      numbersOf({
        cars: [
          carOf({ number: 305, fileCount: 9 }),
          carOf({ number: 76, fileCount: 2, projectId: LEDGER }),
        ],
      }),
    ).toEqual([
      [76, 'First: smallest'],
      [305, null],
    ]);
  });

  it('puts a branch before the one that builds on it, even when larger', () => {
    expect(
      numbersOf({
        cars: [
          carOf({ number: 305, fileCount: 1, base: 'acme/76' }),
          carOf({ number: 76, fileCount: 12 }),
        ],
      }),
    ).toEqual([
      [76, 'First: #305 builds on it'],
      [305, 'After #76, which it builds on'],
    ]);
  });

  it('names both reasons when the first is smallest and carries another', () => {
    expect(
      numbersOf({
        cars: [
          carOf({ number: 305, fileCount: 4, base: 'acme/76' }),
          carOf({ number: 76, fileCount: 2 }),
        ],
      }),
    ).toEqual([
      [76, 'First: smallest, and #305 builds on it'],
      [305, 'After #76, which it builds on'],
    ]);
  });

  it('keeps the order it was given when sizes are unknown', () => {
    expect(numbersOf({ cars: [carOf({ number: 418 }), carOf({ number: 76 })] })).toEqual([
      [418, 'First: waiting longest'],
      [76, null],
    ]);
  });

  it('gives no reason for a single pull request', () => {
    expect(numbersOf({ cars: [carOf({ number: 76, fileCount: 3 })] })).toEqual([[76, null]]);
  });

  it('never links branches of different repositories', () => {
    expect(
      numbersOf({
        cars: [carOf({ number: 305, base: 'acme/76', projectId: LEDGER }), carOf({ number: 76 })],
      }),
    ).toEqual([
      [305, 'First: waiting longest'],
      [76, null],
    ]);
  });
});
