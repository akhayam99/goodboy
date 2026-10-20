import type { FactCardSpec } from '@goodboy/ui';
import type { WorkTime } from './workTime';

type Params = {
  readonly time: WorkTime;
  readonly cost: string | null;
  readonly note: string | null;
};

export const workTimeCardOf = ({ time, cost, note }: Params): FactCardSpec => ({
  title: 'Work time',
  ...(note === null ? {} : { state: { tone: 'warning' as const, words: note } }),
  facts: [...time.facts, ...(cost === null ? [] : [{ label: 'Cost', value: cost }])],
  ...(time.footnote === null ? {} : { footnote: time.footnote }),
});
