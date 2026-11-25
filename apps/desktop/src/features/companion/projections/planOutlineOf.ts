import { safeTextOf } from './safeTextOf';

export const PLAN_STEP_LIMIT = 8;
export const PLAN_TOUCH_LIMIT = 6;
const BULLETS = ['- ', '* '];
const NUMBERED = /^\d{1,3}[.)] /;
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
      const text = line.trim();
      const bullet = BULLETS.find((prefix) => text.startsWith(prefix));
      if (bullet !== undefined) {
        return [text.slice(bullet.length).trim()];
      }
      const numbered = NUMBERED.exec(text);
      return numbered === null ? [] : [text.slice(numbered[0].length).trim()];
    })
    .map((line) => safeTextOf({ text: line.replace(/[*_`]/g, ''), max: 140 }))
    .filter((line) => line.length > 0)
    .slice(0, PLAN_STEP_LIMIT);
  const touches = [...new Set([...source.matchAll(FILE_TOKEN)].map((match) => match[1] ?? ''))]
    .filter((name) => name.length > 0 && !name.startsWith('/'))
    .slice(0, PLAN_TOUCH_LIMIT);
  return { steps, touches };
};
