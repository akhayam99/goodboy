import type { TerminalTab } from '../../shared/types/terminal';

type Params = {
  readonly tabs: ReadonlyArray<TerminalTab>;
  readonly cwd: string | null;
};

export const liveTabAt = ({ tabs, cwd }: Params): TerminalTab | undefined =>
  tabs.find((tab) => tab.cwd === cwd && tab.status !== 'exited' && tab.openError === undefined);
