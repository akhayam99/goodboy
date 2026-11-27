import { describe, expect, it } from 'vitest';
import { formatClock } from '../../../shared/utils/time/formatClock';
import type { ChipRow, ChipView } from './callChipTypes';
import { chipLinesOf } from './chipLinesOf';

const START = new Date(2026, 10, 27, 10, 30).getTime();
const END = START + 32 * 60_000;
const SECOND = 1_000;
const MINUTE = 60_000;
const AT_START = formatClock({ at: START });
const AT_END = formatClock({ at: END });

const ROW: ChipRow = {
  key: 'session-1',
  text: 'notify-relay · 1 question',
  mark: { kind: 'state', state: 'question' },
  canOpen: true,
};

describe('chipLinesOf', () => {
  it('reads the call five minutes before with who waits', () => {
    const lines = chipLinesOf({
      view: {
        kind: 'soon',
        title: 'Northwind sync',
        start: START,
        host: 'meet.google.com',
        rows: [ROW, { ...ROW, key: 'session-2' }],
      },
      now: START - 5 * MINUTE + 20 * SECOND,
    });
    expect(lines.title).toBe('Northwind sync');
    expect(lines.sub).toBe(`${AT_START} · in 5m · meet.google.com`);
    expect(lines.heading).toBe('Before the call · 2 need you');
  });

  it('says nothing waits when no one needs you before the call', () => {
    const lines = chipLinesOf({
      view: { kind: 'soon', title: 'Northwind sync', start: START, host: 'zoom.us', rows: [] },
      now: START - 5 * MINUTE,
    });
    expect(lines.heading).toBe('Nothing waits for you. Agents keep working during the call.');
  });

  it('counts down in seconds in the last minute and says Started after', () => {
    const view = {
      kind: 'countdown',
      title: 'Northwind sync',
      start: START,
      end: END,
      host: 'meet.google.com',
      people: ['Mara Acme', 'Dov Cascadia', 'Ana Harborline'],
    } satisfies ChipView;
    const before = chipLinesOf({ view, now: START - 42 * SECOND });
    expect(before.clock).toBe('in 42s');
    expect(before.isStarted).toBe(false);
    expect(before.sub).toBe('meet.google.com · Mara, Dov and 1 more');
    const after = chipLinesOf({ view, now: START + SECOND });
    expect(after.clock).toBe('Started');
    expect(after.isStarted).toBe(true);
  });

  it('names the host of a link Goodboy does not know', () => {
    const lines = chipLinesOf({
      view: { kind: 'check-link', title: 'Harborline review', host: 'calls.harborline.example' },
      now: START,
    });
    expect(lines.title).toBe('Open calls.harborline.example?');
  });

  it('says how long you have been in the call and how many notices wait', () => {
    const view = {
      kind: 'in-call',
      title: 'Northwind sync',
      end: END,
      joinedAt: START,
      heldCount: 1,
    } satisfies ChipView;
    const lines = chipLinesOf({ view, now: START + 3 * MINUTE + 12 * SECOND });
    expect(lines.title).toBe('In call · Northwind sync');
    expect(lines.sub).toBe(`Goodboy is quiet until ${AT_END} · 1 notice waits`);
    expect(lines.clock).toBe('3m 12s');
    expect(chipLinesOf({ view: { ...view, heldCount: 0 }, now: START }).sub).toBe(
      `Goodboy is quiet until ${AT_END}`,
    );
  });

  it('sums up the call after it ends', () => {
    const lines = chipLinesOf({
      view: { kind: 'after', start: START, end: END, rows: [ROW, ROW] },
      now: END,
    });
    expect(lines.title).toBe('While you were in the call');
    expect(lines.sub).toBe(`${AT_START} to ${AT_END} · 32m · 2 things happened`);
  });

  it('confirms a snooze with the time it comes back', () => {
    const lines = chipLinesOf({
      view: { kind: 'snoozed', start: START, until: START + 5 * MINUTE },
      now: START + SECOND,
    });
    expect(lines.title).toBe(`Snoozed until ${formatClock({ at: START + 5 * MINUTE })}`);
    expect(lines.sub).toBe(`The call started at ${AT_START}.`);
  });
});
