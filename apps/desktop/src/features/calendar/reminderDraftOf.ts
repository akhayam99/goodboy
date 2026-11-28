import { dayStartOf } from './dayStartOf';

export type ReminderDraft = {
  readonly text: string;
  readonly dueAt: number;
};

type Params = {
  readonly text: string;
  readonly now: number;
};

type Clock = {
  readonly hour: number;
  readonly minute: number;
};

const CLOCK = /^(\d{1,2})[:.](\d{2})$/;
const LINK_WORDS: ReadonlySet<string> = new Set(['at', 'by']);
const DEFAULT_CLOCK: Clock = { hour: 9, minute: 0 };
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

type TokenParams = {
  readonly token: string;
};

const clockTokenOf = ({ token }: TokenParams): Clock | null => {
  const match = CLOCK.exec(token);
  if (match === null) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour >= HOURS_IN_DAY || minute >= MINUTES_IN_HOUR) {
    return null;
  }
  return { hour, minute };
};

type DueParams = {
  readonly clock: Clock;
  readonly now: number;
  readonly dayOffset: number;
};

const dueOf = ({ clock, now, dayOffset }: DueParams): number =>
  dayStartOf({ at: now, dayOffset }) + clock.hour * HOUR_MS + clock.minute * MINUTE_MS;

export const reminderDraftOf = ({ text, now }: Params): ReminderDraft => {
  const tokens = text
    .trim()
    .split(' ')
    .filter((token) => token !== '');
  const index = tokens.findIndex((token) => clockTokenOf({ token }) !== null);
  const clock = index === -1 ? null : clockTokenOf({ token: tokens[index] ?? '' });
  if (clock === null) {
    return { text: tokens.join(' '), dueAt: dueOf({ clock: DEFAULT_CLOCK, now, dayOffset: 1 }) };
  }
  const before = tokens[index - 1]?.toLowerCase() ?? '';
  const cut = LINK_WORDS.has(before) ? index - 1 : index;
  const rest = [...tokens.slice(0, cut), ...tokens.slice(index + 1)].join(' ');
  const today = dueOf({ clock, now, dayOffset: 0 });
  return {
    text: rest === '' ? tokens.join(' ') : rest,
    dueAt: today > now ? today : dueOf({ clock, now, dayOffset: 1 }),
  };
};
