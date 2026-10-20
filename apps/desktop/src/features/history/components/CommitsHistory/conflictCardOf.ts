import type { FactCardSpec } from '@goodboy/ui';
import { fitCardRows } from '../../../../shared/utils/fitCardRows';

type Params = {
  readonly conflictFiles: ReadonlyArray<string>;
};

export const conflictCardOf = ({ conflictFiles }: Params): FactCardSpec => {
  const fitted = fitCardRows({
    facts: conflictFiles.map((file, index) => ({ label: `File ${index + 1}`, value: file })),
  });
  return {
    title: 'Replaying this step',
    state: { tone: 'warning', words: `Conflicts in ${conflictFiles.length} files` },
    facts: fitted.facts,
    ...(fitted.footnote === undefined ? {} : { footnote: fitted.footnote }),
  };
};
