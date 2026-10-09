import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { addPin, movePin, removePin } from './pinsChanges';
import type { SessionPin } from './state';

const id = (name: string) => `session-${name}` as SessionId;

const PINS: ReadonlyArray<SessionPin> = [
  { id: id('ledger'), at: 10 },
  { id: id('relay'), at: 20 },
  { id: id('payments'), at: 30 },
];

const idsOf = (pins: ReadonlyArray<SessionPin>) => pins.map((pin) => pin.id);

describe('movePin', () => {
  it('moves a pin down past its neighbour', () => {
    const moved = movePin({ sessionId: id('ledger'), direction: 'down' })(PINS);
    expect(idsOf(moved)).toEqual([id('relay'), id('ledger'), id('payments')]);
    expect(moved.map((pin) => pin.at)).toEqual([10, 20, 30]);
  });

  it('moves a pin up past its neighbour', () => {
    const moved = movePin({ sessionId: id('payments'), direction: 'up' })(PINS);
    expect(idsOf(moved)).toEqual([id('ledger'), id('payments'), id('relay')]);
  });

  it('moves a middle pin both ways', () => {
    expect(idsOf(movePin({ sessionId: id('relay'), direction: 'up' })(PINS))).toEqual([
      id('relay'),
      id('ledger'),
      id('payments'),
    ]);
    expect(idsOf(movePin({ sessionId: id('relay'), direction: 'down' })(PINS))).toEqual([
      id('ledger'),
      id('payments'),
      id('relay'),
    ]);
  });

  it('returns the same list at the ends', () => {
    expect(movePin({ sessionId: id('ledger'), direction: 'up' })(PINS)).toBe(PINS);
    expect(movePin({ sessionId: id('payments'), direction: 'down' })(PINS)).toBe(PINS);
  });

  it('returns the same list for an id that is not pinned', () => {
    expect(movePin({ sessionId: id('ghost'), direction: 'up' })(PINS)).toBe(PINS);
    expect(movePin({ sessionId: id('ghost'), direction: 'down' })([])).toEqual([]);
  });

  it('keeps ids unique and the times distinct after any chain of moves', () => {
    let pins: ReadonlyArray<SessionPin> = PINS;
    const steps = ['down', 'down', 'up', 'down', 'up', 'up'] as const;
    steps.forEach((direction, index) => {
      const target = PINS[index % PINS.length] as SessionPin;
      pins = movePin({ sessionId: target.id, direction })(pins);
      expect(new Set(idsOf(pins)).size).toBe(pins.length);
      expect(new Set(pins.map((pin) => pin.at)).size).toBe(pins.length);
    });
  });

  it('works on a list that grew by addPin and shrank by removePin', () => {
    const grown = addPin({ sessionId: id('notify'), now: 5 })(PINS);
    const trimmed = removePin({ sessionId: id('relay') })(grown);
    const moved = movePin({ sessionId: id('notify'), direction: 'up' })(trimmed);
    expect(idsOf(moved)).toEqual([id('ledger'), id('notify'), id('payments')]);
  });
});
