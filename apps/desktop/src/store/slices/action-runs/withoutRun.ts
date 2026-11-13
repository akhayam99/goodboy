import type { ActionRun } from './types';

type Params = {
  readonly runs: Readonly<Record<string, ActionRun>>;
  readonly key: string;
};

export const withoutRun = ({ runs, key }: Params): Readonly<Record<string, ActionRun>> => {
  if (runs[key] === undefined) {
    return runs;
  }
  return Object.fromEntries(Object.entries(runs).filter(([runKey]) => runKey !== key));
};
