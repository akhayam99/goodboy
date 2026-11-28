import type { DayMatch, DayWord } from './reminderPhraseTypes';
import { wordOf } from './wordOf';

type Params = {
  readonly tokens: ReadonlyArray<string>;
};

type Word = {
  readonly word: DayWord;
  readonly weekday: number;
};

const NO_WEEKDAY = -1;

const DAY_WORDS: Readonly<Record<string, Word>> = {
  today: { word: 'today', weekday: NO_WEEKDAY },
  tonight: { word: 'tonight', weekday: NO_WEEKDAY },
  tomorrow: { word: 'tomorrow', weekday: NO_WEEKDAY },
  sunday: { word: 'weekday', weekday: 0 },
  sun: { word: 'weekday', weekday: 0 },
  monday: { word: 'weekday', weekday: 1 },
  mon: { word: 'weekday', weekday: 1 },
  tuesday: { word: 'weekday', weekday: 2 },
  tue: { word: 'weekday', weekday: 2 },
  tues: { word: 'weekday', weekday: 2 },
  wednesday: { word: 'weekday', weekday: 3 },
  wed: { word: 'weekday', weekday: 3 },
  thursday: { word: 'weekday', weekday: 4 },
  thu: { word: 'weekday', weekday: 4 },
  thur: { word: 'weekday', weekday: 4 },
  thurs: { word: 'weekday', weekday: 4 },
  friday: { word: 'weekday', weekday: 5 },
  fri: { word: 'weekday', weekday: 5 },
  saturday: { word: 'weekday', weekday: 6 },
  sat: { word: 'weekday', weekday: 6 },
};

type KnownParams = {
  readonly word: string;
};

const isKnown = ({ word }: KnownParams): boolean => Object.hasOwn(DAY_WORDS, word);

export const reminderDayOf = ({ tokens }: Params): DayMatch | null => {
  for (let index = 0; index < tokens.length; index += 1) {
    const word = wordOf({ tokens, index });
    const found = isKnown({ word }) ? DAY_WORDS[word] : undefined;
    if (found === undefined) {
      continue;
    }
    const before = wordOf({ tokens, index: index - 1 });
    const isNext = found.word === 'weekday' && before === 'next';
    const hasLink = found.word === 'weekday' && (before === 'next' || before === 'on');
    return {
      ...found,
      isNext,
      start: hasLink ? index - 1 : index,
      length: hasLink ? 2 : 1,
    };
  }
  return null;
};
