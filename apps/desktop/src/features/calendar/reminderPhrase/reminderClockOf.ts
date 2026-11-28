import type { ClockMatch } from './reminderPhraseTypes';
import { wordOf } from './wordOf';

type Params = {
  readonly tokens: ReadonlyArray<string>;
};

type HourParams = {
  readonly hour: number;
  readonly meridiem: string;
};

type MinuteParams = {
  readonly text: string | undefined;
};

type IndexParams = {
  readonly tokens: ReadonlyArray<string>;
  readonly index: number;
};

type SpanParams = IndexParams & {
  readonly length: number;
};

const CLOCK_24 = /^(\d{1,2})[:.](\d{2})$/;
const CLOCK_12 = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)$/;
const BARE_HOUR = /^\d{1,2}$/;
const MERIDIEMS: ReadonlySet<string> = new Set(['am', 'pm']);
const LINK_WORDS: ReadonlySet<string> = new Set(['at', 'by']);
const HOURS_IN_DAY = 24;
const HOURS_ON_FACE = 12;
const MINUTES_IN_HOUR = 60;

const minuteOf = ({ text }: MinuteParams): number => (text === undefined ? 0 : Number(text));

const hourOn24 = ({ hour, meridiem }: HourParams): number | null => {
  if (hour < 1 || hour > HOURS_ON_FACE) {
    return null;
  }
  const base = hour % HOURS_ON_FACE;
  return meridiem === 'pm' ? base + HOURS_ON_FACE : base;
};

const matchOf = ({ tokens, index, length }: SpanParams) => {
  const hasLink = LINK_WORDS.has(wordOf({ tokens, index: index - 1 }));
  return hasLink ? { start: index - 1, length: length + 1 } : { start: index, length };
};

const clockAt = ({ tokens, index }: IndexParams) => {
  const word = wordOf({ tokens, index });
  if (word === 'noon') {
    return { clock: { hour: 12, minute: 0 }, length: 1 };
  }
  if (word === 'midnight') {
    return { clock: { hour: 0, minute: 0 }, length: 1 };
  }
  const twelve = CLOCK_12.exec(word);
  if (twelve !== null) {
    const hour = hourOn24({ hour: Number(twelve[1]), meridiem: twelve[3] ?? '' });
    const minute = minuteOf({ text: twelve[2] });
    return hour === null || minute >= MINUTES_IN_HOUR
      ? null
      : { clock: { hour, minute }, length: 1 };
  }
  const full = CLOCK_24.exec(word);
  if (full !== null) {
    const hour = Number(full[1]);
    const minute = Number(full[2]);
    return hour >= HOURS_IN_DAY || minute >= MINUTES_IN_HOUR
      ? null
      : { clock: { hour, minute }, length: 1 };
  }
  if (!BARE_HOUR.test(word)) {
    return null;
  }
  const meridiem = wordOf({ tokens, index: index + 1 });
  if (MERIDIEMS.has(meridiem)) {
    const hour = hourOn24({ hour: Number(word), meridiem });
    return hour === null ? null : { clock: { hour, minute: 0 }, length: 2 };
  }
  const hour = Number(word);
  const isLinked = LINK_WORDS.has(wordOf({ tokens, index: index - 1 }));
  return isLinked && hour < HOURS_IN_DAY ? { clock: { hour, minute: 0 }, length: 1 } : null;
};

export const reminderClockOf = ({ tokens }: Params): ClockMatch | null => {
  for (let index = 0; index < tokens.length; index += 1) {
    const found = clockAt({ tokens, index });
    if (found !== null) {
      return { clock: found.clock, ...matchOf({ tokens, index, length: found.length }) };
    }
  }
  return null;
};
