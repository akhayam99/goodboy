import { safeTextOf } from './safeTextOf';

export const PLAN_STEP_LIMIT = 8;
export const PLAN_TOUCH_LIMIT = 6;
const STEP_LINE = /^\s*(?:[-*]|\d+[.)])\s+(.+)$/;
const FILE_TOKEN = /`([\w@.-]+(?:\/[\w@.-]+)*\.[A-Za-z0-9]{1,6})`/g;

type Params = {
  readonly source: string;
};

export type PlanOutline = {
  readonly steps: ReadonlyArray<string>;
  readonly touches: ReadonlyArray<string>;
};

export const planOutlineOf = ({ source }: Params): PlanOutline => {
  const steps = source
    .split('\n')
    .flatMap((line) => {
      const match = STEP_LINE.exec(line);
      return match?.[1] === undefined ? [] : [match[1].trim()];
    })
    .map((line) => safeTextOf({ text: line.replace(/[*_`]/g, ''), max: 140 }))
    .filter((line) => line.length > 0)
    .slice(0, PLAN_STEP_LIMIT);
  const touches = [...new Set([...source.matchAll(FILE_TOKEN)].map((match) => match[1] ?? ''))]
    .filter((name) => name.length > 0 && !name.startsWith('/'))
    .slice(0, PLAN_TOUCH_LIMIT);
  return { steps, touches };
};
