import { describe, expect, it } from 'vitest';
import type { ProviderHeadroom } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { canSpreadByHeadroom, nextStepPick, type RulesProviderRoom } from './rulesHeadroom';

type RoomParams = {
  readonly id: ProviderId;
  readonly headroom?: ProviderHeadroom;
  readonly state?: RulesProviderRoom['state'];
  readonly reportsLimits?: boolean;
  readonly used?: number | null;
};

const room = ({
  id,
  headroom = 'ok',
  state = 'on',
  reportsLimits = true,
  used = null,
}: RoomParams): RulesProviderRoom => ({
  id,
  name: id,
  state,
  reportsLimits,
  headroom,
  used,
});

const pickOf = (rooms: ReadonlyArray<RulesProviderRoom>, spread: boolean) => {
  const pick = nextStepPick({ rooms, spread });
  return pick === null ? null : { name: pick.name, kind: pick.reason.kind };
};

describe('nextStepPick', () => {
  it('goes first in the order when spreading is off, whatever the room', () => {
    const rooms = [room({ id: 'anthropic', headroom: 'out' }), room({ id: 'codex' })];

    expect(pickOf(rooms, false)).toEqual({ name: 'anthropic', kind: 'first-in-order' });
  });

  it('skips a tight provider when spreading is on and names how full it is', () => {
    const rooms = [room({ id: 'anthropic', headroom: 'tight', used: 0.85 }), room({ id: 'codex' })];

    expect(nextStepPick({ rooms, spread: true })).toEqual({
      name: 'codex',
      reason: { kind: 'passed-tight', passed: 'anthropic', used: 0.85 },
    });
  });

  it('gives no work to a provider that is out', () => {
    const rooms = [room({ id: 'anthropic', headroom: 'out' }), room({ id: 'codex' })];

    expect(pickOf(rooms, true)).toEqual({ name: 'codex', kind: 'passed-out' });
  });

  it('keeps the first provider when nobody before it is short of room', () => {
    const rooms = [room({ id: 'anthropic' }), room({ id: 'codex', headroom: 'tight' })];

    expect(pickOf(rooms, true)).toEqual({ name: 'anthropic', kind: 'most-room' });
  });

  it('ignores providers that are not on', () => {
    const rooms = [room({ id: 'anthropic', state: 'backup' }), room({ id: 'codex' })];

    expect(pickOf(rooms, false)).toEqual({ name: 'codex', kind: 'first-in-order' });
  });

  it('picks nothing when no provider is on', () => {
    expect(pickOf([room({ id: 'anthropic', state: 'off' })], true)).toBeNull();
  });
});

describe('canSpreadByHeadroom', () => {
  it('is true when a provider that is on reports its limits', () => {
    expect(canSpreadByHeadroom({ rooms: [room({ id: 'codex' })] })).toBe(true);
  });

  it('is false when no provider that is on reports its limits', () => {
    const rooms = [
      room({ id: 'cursor', reportsLimits: false }),
      room({ id: 'anthropic', state: 'backup' }),
    ];

    expect(canSpreadByHeadroom({ rooms })).toBe(false);
  });
});
