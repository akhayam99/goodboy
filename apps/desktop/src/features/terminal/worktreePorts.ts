import type { TerminalTab } from '../../shared/types/terminal';

type Params = {
  readonly tabs: ReadonlyArray<TerminalTab>;
  readonly portsByTerminal: ReadonlyMap<string, ReadonlyArray<number>>;
};

export const worktreePorts = ({ tabs, portsByTerminal }: Params): ReadonlyArray<number> =>
  [...new Set(tabs.flatMap((tab) => portsByTerminal.get(tab.id) ?? []))].sort(
    (left, right) => left - right,
  );
