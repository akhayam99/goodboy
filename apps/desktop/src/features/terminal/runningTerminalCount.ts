import type { TerminalTab } from '../../shared/types/terminal';

type Params = {
  readonly tabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
};

export const runningTerminalCount = ({ tabs }: Params): number =>
  Object.values(tabs).reduce(
    (total, list) => total + list.filter((tab) => tab.status !== 'exited').length,
    0,
  );
