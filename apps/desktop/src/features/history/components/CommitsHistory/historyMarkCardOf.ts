import type { Fact, FactCardSpec } from '@goodboy/ui';
import { fitCardRows } from '../../../../shared/utils/fitCardRows';

type Params = {
  readonly label: string;
  readonly facts: ReadonlyArray<Fact>;
  readonly note?: string;
};

export const historyMarkCardOf = ({ label, facts, note }: Params): FactCardSpec => {
  const fitted = fitCardRows({ facts });
  const footnote = [fitted.footnote, note]
    .filter((part): part is string => part !== undefined)
    .join('. ');
  return {
    title: label,
    facts: fitted.facts,
    ...(footnote === '' ? {} : { footnote }),
  };
};
