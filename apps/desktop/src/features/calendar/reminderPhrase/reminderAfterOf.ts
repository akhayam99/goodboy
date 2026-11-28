import type { AfterMatch, AfterUnit } from './reminderPhraseTypes';
import { wordOf } from './wordOf';

type Params = {
  readonly tokens: ReadonlyArray<string>;
};

type UnitParams = {
  readonly word: string;
};

type Unit = {
  readonly unit: AfterUnit;
  readonly factor: number;
};

type AtParams = {
  readonly tokens: ReadonlyArray<string>;
  readonly index: number;
};

const DAYS_IN_WEEK = 7;
const HALF_AN_HOUR = 30;
const COUNT = /^\d{1,4}$/;
const GLUED = /^(\d{1,4})([a-z]{1,7})$/;

const UNITS: Readonly<Record<string, Unit>> = {
  m: { unit: 'minutes', factor: 1 },
  min: { unit: 'minutes', factor: 1 },
  mins: { unit: 'minutes', factor: 1 },
  minute: { unit: 'minutes', factor: 1 },
  minutes: { unit: 'minutes', factor: 1 },
  h: { unit: 'hours', factor: 1 },
  hr: { unit: 'hours', factor: 1 },
  hrs: { unit: 'hours', factor: 1 },
  hour: { unit: 'hours', factor: 1 },
  hours: { unit: 'hours', factor: 1 },
  d: { unit: 'days', factor: 1 },
  day: { unit: 'days', factor: 1 },
  days: { unit: 'days', factor: 1 },
  w: { unit: 'days', factor: DAYS_IN_WEEK },
  week: { unit: 'days', factor: DAYS_IN_WEEK },
  weeks: { unit: 'days', factor: DAYS_IN_WEEK },
};

const unitOf = ({ word }: UnitParams): Unit | null =>
  Object.hasOwn(UNITS, word) ? (UNITS[word] ?? null) : null;

const afterAt = ({ tokens, index }: AtParams): AfterMatch | null => {
  const first = wordOf({ tokens, index: index + 1 });
  const second = wordOf({ tokens, index: index + 2 });
  const start = index;
  if (first === 'half' && second === 'an' && wordOf({ tokens, index: index + 3 }) === 'hour') {
    return { start, length: 4, unit: 'minutes', amount: HALF_AN_HOUR };
  }
  const glued = GLUED.exec(first);
  const gluedUnit = glued === null ? null : unitOf({ word: glued[2] ?? '' });
  if (glued !== null && gluedUnit !== null) {
    return {
      start,
      length: 2,
      unit: gluedUnit.unit,
      amount: Number(glued[1]) * gluedUnit.factor,
    };
  }
  const isCount = COUNT.test(first);
  const isArticle = first === 'a' || first === 'an';
  const unit = isCount || isArticle ? unitOf({ word: second }) : null;
  if (unit === null) {
    return null;
  }
  return {
    start,
    length: 3,
    unit: unit.unit,
    amount: (isArticle ? 1 : Number(first)) * unit.factor,
  };
};

export const reminderAfterOf = ({ tokens }: Params): AfterMatch | null => {
  for (let index = 0; index < tokens.length; index += 1) {
    if (wordOf({ tokens, index }) !== 'in') {
      continue;
    }
    const found = afterAt({ tokens, index });
    if (found !== null && found.amount > 0) {
      return found;
    }
  }
  return null;
};
