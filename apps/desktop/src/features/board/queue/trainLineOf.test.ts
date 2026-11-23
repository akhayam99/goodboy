// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { MergeTrain } from '../../../store/slices/pr-series/mergeTrain';
import { trainLineOf } from './trainLineOf';

const TRAIN: MergeTrain = {
  id: 'train-1',
  cars: [
    {
      sessionId: brandId<SessionId>({ value: 's-1' }),
      mountId: brandId<MountId>({ value: 'm-76' }),
      prNumber: 76,
      repo: 'notify-relay',
      base: 'main',
    },
    {
      sessionId: brandId<SessionId>({ value: 's-2' }),
      mountId: brandId<MountId>({ value: 'm-305' }),
      prNumber: 305,
      repo: 'notify-relay',
      base: 'main',
    },
  ],
  method: 'squash',
  index: 0,
  step: 'merging',
  hasUpdated: false,
  merged: 0,
  isStopRequested: false,
  outcome: null,
};

describe('trainLineOf', () => {
  it.each([
    [{}, 'Merging 1 of 2 · #76 notify-relay'],
    [{ step: 'waiting' as const }, 'Merging 1 of 2 · #76 notify-relay · checks running'],
    [{ index: 1, step: 'updating' as const, merged: 1 }, 'Updating #305 on main'],
    [
      { index: 1, step: 'waiting' as const, merged: 1, hasUpdated: true },
      'Updating #305 on main · checks running',
    ],
    [{ merged: 2, outcome: { kind: 'done' as const } }, 'Merged 2 of 2'],
    [{ merged: 1, outcome: { kind: 'halted' as const } }, 'Stopped after 1 of 2'],
    [
      {
        index: 1,
        merged: 1,
        outcome: {
          kind: 'stopped' as const,
          reason: '#305 has conflicts. The Lead has it',
          isWithLead: true,
        },
      },
      'Merged 1 of 2 · #305 has conflicts. The Lead has it',
    ],
  ])('reads %o as one line', (patch, line) => {
    expect(trainLineOf({ train: { ...TRAIN, ...patch } })).toBe(line);
  });
});
