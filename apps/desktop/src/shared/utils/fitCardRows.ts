import type { Fact } from '@goodboy/ui';

const MAX_ROWS = 6;

type Params = {
  readonly facts: ReadonlyArray<Fact>;
};

type FittedRows = {
  readonly facts: ReadonlyArray<Fact>;
  readonly footnote?: string;
};

export const fitCardRows = ({ facts }: Params): FittedRows => {
  if (facts.length <= MAX_ROWS) {
    return { facts };
  }
  const shown = MAX_ROWS - 1;
  return { facts: facts.slice(0, shown), footnote: `and ${facts.length - shown} more` };
};
