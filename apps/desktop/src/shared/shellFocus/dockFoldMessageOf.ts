import type { DockFold } from '@goodboy/ui';

type LabelParams = {
  readonly key: string;
};

type Params = {
  readonly fold: DockFold;
  readonly labelOf: (params: LabelParams) => string;
};

export const dockFoldMessageOf = ({ fold, labelOf }: Params): string =>
  [...new Set(fold.folds.map((folded) => folded.into))]
    .map((host) => {
      const names = fold.folds
        .filter((folded) => folded.into === host)
        .map((folded) => labelOf({ key: folded.key }));
      return `${names.join(' and ')} folded into the ${labelOf({ key: host })} tab`;
    })
    .join('. ');
