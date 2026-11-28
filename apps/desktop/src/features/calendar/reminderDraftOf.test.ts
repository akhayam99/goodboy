import { describe, expect, it } from 'vitest';
import { reminderDraftOf } from './reminderDraftOf';

const NOW = new Date(2026, 10, 27, 10, 18, 40).getTime();

type AtParams = {
  readonly dayOffset: number;
  readonly hour: number;
  readonly minute: number;
};

const at = ({ dayOffset, hour, minute }: AtParams): number =>
  new Date(2026, 10, 27 + dayOffset, hour, minute).getTime();

type PhraseParams = {
  readonly text: string;
  readonly now?: number;
};

const draft = ({ text, now = NOW }: PhraseParams) => reminderDraftOf({ text, now });

describe('reminderDraftOf', () => {
  it('reads HH:MM later today and drops the word before it', () => {
    expect(draft({ text: 'ping Teo at 17:00' })).toEqual({
      text: 'ping Teo',
      dueAt: at({ dayOffset: 0, hour: 17, minute: 0 }),
    });
  });

  it('reads H.MM anywhere in the text', () => {
    expect(draft({ text: 'call Acme 9.30 about ledger-core' })).toEqual({
      text: 'call Acme about ledger-core',
      dueAt: at({ dayOffset: 1, hour: 9, minute: 30 }),
    });
  });

  it('moves a time already past today to tomorrow only when no day was given', () => {
    expect(draft({ text: 'standup notes by 08:00' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 8, minute: 0 }),
    );
    expect(draft({ text: 'standup notes today at 08:00' }).dueAt).toBe(
      at({ dayOffset: 0, hour: 8, minute: 0 }),
    );
  });

  it('reads "at 11pm today" and keeps only the words of the reminder', () => {
    expect(draft({ text: 'ask for a beer at 11pm today' })).toEqual({
      text: 'ask for a beer',
      dueAt: at({ dayOffset: 0, hour: 23, minute: 0 }),
    });
  });

  it('reads a 12 hour clock with a glued or a spaced am and pm', () => {
    expect(draft({ text: 'call Harborline at 5:30pm' })).toEqual({
      text: 'call Harborline',
      dueAt: at({ dayOffset: 0, hour: 17, minute: 30 }),
    });
    expect(draft({ text: 'call Harborline at 5 pm' }).dueAt).toBe(
      at({ dayOffset: 0, hour: 17, minute: 0 }),
    );
    expect(draft({ text: 'stretch 9am' }).dueAt).toBe(at({ dayOffset: 1, hour: 9, minute: 0 }));
    expect(draft({ text: 'sync at 12am' }).dueAt).toBe(at({ dayOffset: 1, hour: 0, minute: 0 }));
    expect(draft({ text: 'lunch at 12pm' }).dueAt).toBe(at({ dayOffset: 0, hour: 12, minute: 0 }));
  });

  it('reads a bare hour after at or by as a 24 hour clock', () => {
    expect(draft({ text: 'send notes at 17' })).toEqual({
      text: 'send notes',
      dueAt: at({ dayOffset: 0, hour: 17, minute: 0 }),
    });
    expect(draft({ text: 'review 3 PRs' }).dueAt).toBe(at({ dayOffset: 1, hour: 9, minute: 0 }));
  });

  it('reads tomorrow with or without a time', () => {
    expect(draft({ text: 'tomorrow at 9 ping Teo' })).toEqual({
      text: 'ping Teo',
      dueAt: at({ dayOffset: 1, hour: 9, minute: 0 }),
    });
    expect(draft({ text: 'ping Teo tomorrow at 4:15pm' })).toEqual({
      text: 'ping Teo',
      dueAt: at({ dayOffset: 1, hour: 16, minute: 15 }),
    });
    expect(draft({ text: 'ping Teo tomorrow' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 9, minute: 0 }),
    );
  });

  it('reads today and tonight with no time', () => {
    expect(draft({ text: 'file the Acme report today' })).toEqual({
      text: 'file the Acme report',
      dueAt: at({ dayOffset: 0, hour: 11, minute: 0 }),
    });
    expect(draft({ text: 'pack bags tonight' })).toEqual({
      text: 'pack bags',
      dueAt: at({ dayOffset: 0, hour: 20, minute: 0 }),
    });
  });

  it('reads a weekday, the next one, and rolls a past one a week', () => {
    expect(draft({ text: 'plan Cascadia on monday' })).toEqual({
      text: 'plan Cascadia',
      dueAt: at({ dayOffset: 3, hour: 9, minute: 0 }),
    });
    expect(draft({ text: 'plan Cascadia next friday at 14:00' })).toEqual({
      text: 'plan Cascadia',
      dueAt: at({ dayOffset: 7, hour: 14, minute: 0 }),
    });
    expect(draft({ text: 'plan Cascadia friday at 14:00' }).dueAt).toBe(
      at({ dayOffset: 0, hour: 14, minute: 0 }),
    );
    expect(draft({ text: 'plan Cascadia friday at 8:00' }).dueAt).toBe(
      at({ dayOffset: 7, hour: 8, minute: 0 }),
    );
    expect(draft({ text: 'plan Cascadia fri' }).dueAt).toBe(
      at({ dayOffset: 7, hour: 9, minute: 0 }),
    );
  });

  it('reads noon and midnight', () => {
    expect(draft({ text: 'lunch with Teo at noon' })).toEqual({
      text: 'lunch with Teo',
      dueAt: at({ dayOffset: 0, hour: 12, minute: 0 }),
    });
    expect(draft({ text: 'ship ledger-core at midnight' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 0, minute: 0 }),
    );
  });

  it('reads a delay in minutes, hours, days and weeks', () => {
    const now = new Date(2026, 10, 27, 10, 18).getTime();
    expect(draft({ text: 'check the deploy in 30 minutes' })).toEqual({
      text: 'check the deploy',
      dueAt: new Date(2026, 10, 27, 10, 48).getTime(),
    });
    expect(draft({ text: 'in 2 hours stretch', now }).dueAt).toBe(
      new Date(2026, 10, 27, 12, 18).getTime(),
    );
    expect(draft({ text: 'nudge Teo in 45m' })).toEqual({
      text: 'nudge Teo',
      dueAt: new Date(2026, 10, 27, 11, 3).getTime(),
    });
    expect(draft({ text: 'nudge Teo in an hour' }).dueAt).toBe(
      new Date(2026, 10, 27, 11, 18).getTime(),
    );
    expect(draft({ text: 'nudge Teo in half an hour' }).dueAt).toBe(
      new Date(2026, 10, 27, 10, 48).getTime(),
    );
    expect(draft({ text: 'renew in 2 days at 10:00' })).toEqual({
      text: 'renew',
      dueAt: at({ dayOffset: 2, hour: 10, minute: 0 }),
    });
    expect(draft({ text: 'renew in 1 week' }).dueAt).toBe(at({ dayOffset: 7, hour: 9, minute: 0 }));
  });

  it('defaults to tomorrow at 09:00 with no time in the text', () => {
    expect(draft({ text: '  Review the notify-relay plan ' })).toEqual({
      text: 'Review the notify-relay plan',
      dueAt: at({ dayOffset: 1, hour: 9, minute: 0 }),
    });
    expect(draft({ text: 'ask for a beer' })).toEqual({
      text: 'ask for a beer',
      dueAt: at({ dayOffset: 1, hour: 9, minute: 0 }),
    });
  });

  it('ignores a clock that does not exist and keeps a text made of the time alone', () => {
    expect(draft({ text: 'rotate keys 25:61' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 9, minute: 0 }),
    );
    expect(draft({ text: 'rotate keys at 13pm' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 9, minute: 0 }),
    );
    expect(draft({ text: '17:00' }).text).toBe('17:00');
    expect(draft({ text: 'tomorrow' }).text).toBe('tomorrow');
  });

  it('ignores a delay without a number or a known unit', () => {
    expect(draft({ text: 'check in with Teo' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 9, minute: 0 }),
    );
    expect(draft({ text: 'check in 5 apples' }).dueAt).toBe(
      at({ dayOffset: 1, hour: 9, minute: 0 }),
    );
  });

  it('stays linear on a long run of digits or marks', () => {
    const digits = `${'1'.repeat(20_000)}:`;
    expect(draft({ text: digits }).text).toBe(digits);
    const marks = `${','.repeat(20_000)}x`;
    expect(draft({ text: marks }).text).toBe(marks);
  });
});
