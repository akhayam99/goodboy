import { reminderAfterOf } from './reminderPhrase/reminderAfterOf';
import { reminderClockOf } from './reminderPhrase/reminderClockOf';
import { reminderDayOf } from './reminderPhrase/reminderDayOf';
import type { Clock, DayMatch, Span } from './reminderPhrase/reminderPhraseTypes';

export type ReminderDraft = {
  readonly text: string;
  readonly dueAt: number;
};

type Params = {
  readonly text: string;
  readonly now: number;
};

type DueParams = {
  readonly clock: Clock;
  readonly now: number;
  readonly dayOffset: number;
};

type DayOffsetParams = {
  readonly day: DayMatch;
  readonly now: number;
};

type TextParams = {
  readonly tokens: ReadonlyArray<string>;
  readonly spans: ReadonlyArray<Span | null>;
};

const DEFAULT_CLOCK: Clock = { hour: 9, minute: 0 };
const TONIGHT_CLOCK: Clock = { hour: 20, minute: 0 };
const DAYS_IN_WEEK = 7;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const dueOf = ({ clock, now, dayOffset }: DueParams): number => {
  const date = new Date(now);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
    clock.hour,
    clock.minute,
  ).getTime();
};

const dayOffsetOf = ({ day, now }: DayOffsetParams): number => {
  switch (day.word) {
    case 'today':
    case 'tonight':
      return 0;
    case 'tomorrow':
      return 1;
    case 'weekday': {
      const gap = (day.weekday - new Date(now).getDay() + DAYS_IN_WEEK) % DAYS_IN_WEEK;
      return gap === 0 && day.isNext ? DAYS_IN_WEEK : gap;
    }
    default: {
      const unreachable: never = day.word;
      return unreachable;
    }
  }
};

const defaultClockOf = ({ day, now }: DayOffsetParams): Clock => {
  if (day.word === 'tonight') {
    return TONIGHT_CLOCK;
  }
  if (day.word === 'today') {
    return { hour: new Date(now).getHours() + 1, minute: 0 };
  }
  return DEFAULT_CLOCK;
};

const reminderTextOf = ({ tokens, spans }: TextParams): string => {
  const removed = new Set<number>();
  for (const span of spans) {
    if (span === null) {
      continue;
    }
    for (let index = span.start; index < span.start + span.length; index += 1) {
      removed.add(index);
    }
  }
  const rest = tokens.filter((_, index) => !removed.has(index)).join(' ');
  return rest === '' ? tokens.join(' ') : rest;
};

export const reminderDraftOf = ({ text, now }: Params): ReminderDraft => {
  const tokens = text
    .trim()
    .split(' ')
    .filter((token) => token !== '');
  const after = reminderAfterOf({ tokens });
  if (after !== null && after.unit !== 'days') {
    const unitMs = after.unit === 'minutes' ? MINUTE_MS : HOUR_MS;
    const from = Math.floor(now / MINUTE_MS) * MINUTE_MS;
    return {
      text: reminderTextOf({ tokens, spans: [after] }),
      dueAt: from + after.amount * unitMs,
    };
  }
  const clockMatch = reminderClockOf({ tokens });
  const day = reminderDayOf({ tokens });
  const spans = [after, clockMatch, day];
  const shownText = reminderTextOf({ tokens, spans });
  if (after !== null) {
    const clock = clockMatch?.clock ?? DEFAULT_CLOCK;
    return { text: shownText, dueAt: dueOf({ clock, now, dayOffset: after.amount }) };
  }
  if (day === null) {
    if (clockMatch === null) {
      return { text: shownText, dueAt: dueOf({ clock: DEFAULT_CLOCK, now, dayOffset: 1 }) };
    }
    const today = dueOf({ clock: clockMatch.clock, now, dayOffset: 0 });
    const dueAt = today > now ? today : dueOf({ clock: clockMatch.clock, now, dayOffset: 1 });
    return { text: shownText, dueAt };
  }
  const clock = clockMatch?.clock ?? defaultClockOf({ day, now });
  const offset = dayOffsetOf({ day, now });
  const due = dueOf({ clock, now, dayOffset: offset });
  const isWeekdayPast = day.word === 'weekday' && offset === 0 && due <= now;
  return {
    text: shownText,
    dueAt: isWeekdayPast ? dueOf({ clock, now, dayOffset: DAYS_IN_WEEK }) : due,
  };
};
