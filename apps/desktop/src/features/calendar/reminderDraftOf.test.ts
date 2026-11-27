import { describe, expect, it } from 'vitest';
import { reminderDraftOf } from './reminderDraftOf';

const NOW = new Date(2026, 10, 27, 10, 18).getTime();

type AtParams = {
  readonly dayOffset: number;
  readonly hour: number;
  readonly minute: number;
};

const at = ({ dayOffset, hour, minute }: AtParams): number =>
  new Date(2026, 10, 27 + dayOffset, hour, minute).getTime();

describe('reminderDraftOf', () => {
  it('reads HH:MM later today and drops the word before it', () => {
    expect(reminderDraftOf({ text: 'ping Teo at 17:00', now: NOW })).toEqual({
      text: 'ping Teo',
      dueAt: at({ dayOffset: 0, hour: 17, minute: 0 }),
    });
  });

  it('reads H.MM anywhere in the text', () => {
    expect(reminderDraftOf({ text: 'call Acme 9.30 about ledger-core', now: NOW })).toEqual({
      text: 'call Acme about ledger-core',
      dueAt: at({ dayOffset: 1, hour: 9, minute: 30 }),
    });
  });

  it('moves a time already past today to tomorrow', () => {
    expect(reminderDraftOf({ text: 'standup notes by 08:00', now: NOW }).dueAt).toBe(
      at({ dayOffset: 1, hour: 8, minute: 0 }),
    );
  });

  it('defaults to tomorrow at 09:00 with no time in the text', () => {
    expect(reminderDraftOf({ text: '  Review the notify-relay plan ', now: NOW })).toEqual({
      text: 'Review the notify-relay plan',
      dueAt: at({ dayOffset: 1, hour: 9, minute: 0 }),
    });
  });

  it('ignores a clock that does not exist and keeps a text made of the time alone', () => {
    expect(reminderDraftOf({ text: 'rotate keys 25:61', now: NOW }).dueAt).toBe(
      at({ dayOffset: 1, hour: 9, minute: 0 }),
    );
    expect(reminderDraftOf({ text: '17:00', now: NOW }).text).toBe('17:00');
  });

  it('stays linear on a long run of digits', () => {
    const text = `${'1'.repeat(20_000)}:`;
    expect(reminderDraftOf({ text, now: NOW }).text).toBe(text);
  });
});
