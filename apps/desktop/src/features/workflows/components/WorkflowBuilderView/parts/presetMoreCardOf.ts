import type { FactCardSpec } from '@goodboy/ui';
import { fitCardRows } from '../../../../../shared/utils/fitCardRows';
import type { PresetStepMark } from '../../../presetStepMarksOf';

type Params = {
  readonly hidden: ReadonlyArray<PresetStepMark>;
};

export const presetMoreCardOf = ({ hidden }: Params): FactCardSpec => {
  const fitted = fitCardRows({
    facts: hidden.map((mark) => ({ label: `Step ${mark.position}`, value: mark.roleName })),
  });
  return {
    title: `${hidden.length} more steps`,
    facts: fitted.facts,
    ...(fitted.footnote === undefined ? {} : { footnote: fitted.footnote }),
  };
};
