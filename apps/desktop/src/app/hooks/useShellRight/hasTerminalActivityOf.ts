import type { AppState } from '../../../store/types';
import type { TerminalTab } from '../../../shared/types/terminal';

type Params = {
  readonly state: Pick<AppState, 'terminalTabs' | 'terminalFinishes' | 'currentSessionId'>;
};

const NO_TABS: Readonly<Record<string, ReadonlyArray<TerminalTab>>> = {};

export const hasTerminalActivityOf = ({ state }: Params): boolean => {
  const sessionId = state.currentSessionId;
  const finishes = state.terminalFinishes ?? {};
  return (
    Object.values(state.terminalTabs ?? NO_TABS).some((tabs) =>
      tabs.some((tab) => tab.status === 'attention'),
    ) ||
    (sessionId !== null && finishes[sessionId] != null)
  );
};
