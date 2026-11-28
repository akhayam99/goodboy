import { describe, expect, it } from 'vitest';
import type { AwayBanner } from '../../notifications/away/awayBannersOf';
import type { ChipCall, ChipInput, ChipState } from './callChipTypes';
import { reduceCallChip } from './reduceCallChip';

const START = Date.UTC(2026, 10, 27, 10, 30);
const MINUTE = 60_000;

const SYNC: ChipCall = {
  id: 'northwind-sync',
  title: 'Northwind sync',
  start: START,
  end: START + 30 * MINUTE,
  link: 'https://meet.google.com/abc-defg-hij',
  isLinkTrusted: true,
  people: ['Mara Acme', 'Dov Cascadia'],
};

const UNKNOWN: ChipCall = {
  ...SYNC,
  id: 'harborline-review',
  link: 'https://calls.harborline.example/r/1',
  isLinkTrusted: false,
};

const HELD: AwayBanner = {
  sessionId: null,
  reason: 'open-question',
  title: 'ledger-core',
  body: '1 question',
  keys: ['ledger-core:open-question'],
};

const HIDDEN: ChipState = { kind: 'hidden' };

type RunParams = {
  readonly state: ChipState;
  readonly input: ChipInput;
  readonly now?: number;
};

const run = ({ state, input, now = START - 5 * MINUTE }: RunParams) =>
  reduceCallChip({ state, input, now });

describe('reduceCallChip', () => {
  it('shows the call and who waits five minutes before, and the countdown one minute before', () => {
    const soon = run({
      state: HIDDEN,
      input: { kind: 'alert', moment: 'five-minutes', call: SYNC },
    });
    expect(soon.state).toEqual({ kind: 'soon', call: SYNC });
    const countdown = run({
      state: soon.state,
      input: { kind: 'alert', moment: 'one-minute', call: SYNC },
      now: START - MINUTE,
    });
    expect(countdown.state).toEqual({ kind: 'countdown', call: SYNC });
    expect(countdown.effects).toEqual([]);
  });

  it('asks to open a link from a known call app at once and changes nothing yet', () => {
    const countdown: ChipState = { kind: 'countdown', call: SYNC };
    const asked = run({ state: countdown, input: { kind: 'join' } });
    expect(asked.state).toBe(countdown);
    expect(asked.effects).toEqual([{ kind: 'open-link', call: SYNC }]);
  });

  it('goes quiet until the end once the link opened, from the chip or from the panel', () => {
    for (const state of [{ kind: 'countdown', call: SYNC } satisfies ChipState, HIDDEN]) {
      const joined = run({ state, input: { kind: 'joined', call: SYNC } });
      expect(joined.state).toEqual({ kind: 'in-call', call: SYNC, joinedAt: START - 5 * MINUTE });
      expect(joined.effects).toEqual([{ kind: 'quiet', eventId: SYNC.id, until: SYNC.end }]);
    }
  });

  it('stays loud when the opened call is far ahead or already over', () => {
    for (const now of [START - 60 * MINUTE, SYNC.end]) {
      const early = run({ state: HIDDEN, input: { kind: 'joined', call: SYNC }, now });
      expect(early).toEqual({ state: HIDDEN, effects: [] });
    }
  });

  it('shows the host of an unknown link first and opens it on the second click', () => {
    const first = run({ state: { kind: 'countdown', call: UNKNOWN }, input: { kind: 'join' } });
    expect(first.state).toEqual({ kind: 'check-link', call: UNKNOWN });
    expect(first.effects).toEqual([]);
    const second = run({ state: first.state, input: { kind: 'join' } });
    expect(second.effects).toEqual([{ kind: 'open-link', call: UNKNOWN }]);
  });

  it('asks Rust to come back in five minutes and says snoozed only once Rust agreed', () => {
    const now = START - MINUTE;
    const countdown: ChipState = { kind: 'countdown', call: SYNC };
    const asked = run({ state: countdown, input: { kind: 'snooze' }, now });
    expect(asked.state).toBe(countdown);
    expect(asked.effects).toEqual([{ kind: 'snooze', eventId: SYNC.id, at: now + 5 * MINUTE }]);
    const snoozed = run({
      state: asked.state,
      input: { kind: 'snoozed', eventId: SYNC.id, until: now + 5 * MINUTE },
      now,
    });
    expect(snoozed.state).toEqual({ kind: 'snoozed', call: SYNC, until: now + 5 * MINUTE });
    const other = run({
      state: countdown,
      input: { kind: 'snoozed', eventId: 'acme-review', until: now + 5 * MINUTE },
    });
    expect(other.state).toBe(countdown);
    const back = run({
      state: HIDDEN,
      input: { kind: 'alert', moment: 'snoozed', call: SYNC },
      now: now + 5 * MINUTE,
    });
    expect(back.state).toEqual({ kind: 'countdown', call: SYNC });
  });

  it('opens the call again from Return to call', () => {
    const inCall: ChipState = { kind: 'in-call', call: SYNC, joinedAt: START };
    const back = run({ state: inCall, input: { kind: 'return' }, now: START + MINUTE });
    expect(back.state).toBe(inCall);
    expect(back.effects).toEqual([{ kind: 'open-link', call: SYNC }]);
  });

  it('keeps the in call chip when a late alert of the same call arrives', () => {
    const inCall: ChipState = { kind: 'in-call', call: SYNC, joinedAt: START };
    const late = run({
      state: inCall,
      input: { kind: 'alert', moment: 'one-minute', call: SYNC },
      now: START + MINUTE,
    });
    expect(late.state).toBe(inCall);
  });

  it('shows what happened after the call when notices were held', () => {
    const inCall: ChipState = { kind: 'in-call', call: SYNC, joinedAt: START };
    const after = run({ state: inCall, input: { kind: 'ended', call: SYNC, held: [HELD] } });
    expect(after.state).toEqual({ kind: 'after', call: SYNC, joinedAt: START, held: [HELD] });
    const quiet = run({ state: inCall, input: { kind: 'ended', call: SYNC, held: [] } });
    expect(quiet.state).toEqual(HIDDEN);
  });

  it('ignores the end of another call and alerts for a call already over', () => {
    const soon: ChipState = { kind: 'soon', call: UNKNOWN };
    expect(run({ state: soon, input: { kind: 'ended', call: SYNC, held: [HELD] } }).state).toBe(
      soon,
    );
    const over = run({
      state: HIDDEN,
      input: { kind: 'alert', moment: 'snoozed', call: SYNC },
      now: SYNC.end,
    });
    expect(over.state).toBe(HIDDEN);
  });

  it('hides from every state and never acts once hidden', () => {
    expect(run({ state: { kind: 'soon', call: SYNC }, input: { kind: 'hide' } }).state).toEqual(
      HIDDEN,
    );
    const joined = run({ state: HIDDEN, input: { kind: 'join' } });
    expect(joined).toEqual({ state: HIDDEN, effects: [] });
  });
});
