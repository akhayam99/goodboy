import { describe, expect, it } from 'vitest';
import { calendarIdentity } from './calendarIdentity';

const SLOTS = Array.from({ length: 8 }, (_, index) => `var(--color-identity-${index + 1})`);

describe('calendarIdentity', () => {
  it('gives one calendar the same identity colour every time', () => {
    const color = calendarIdentity({ sourceId: 'mac', calendarId: 'harborline-work' });
    expect(color).toBe(calendarIdentity({ sourceId: 'mac', calendarId: 'harborline-work' }));
  });

  it('reads only the eight identity slots, never a tone', () => {
    for (const calendarId of ['work', 'focus', 'northwind', 'acme', 'cascadia', 'ledger-core']) {
      expect(SLOTS).toContain(calendarIdentity({ sourceId: 'mac', calendarId }));
    }
  });

  it('keeps two calendars of different sources apart', () => {
    const colors = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((sourceId) =>
        calendarIdentity({ sourceId, calendarId: 'work' }),
      ),
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});
