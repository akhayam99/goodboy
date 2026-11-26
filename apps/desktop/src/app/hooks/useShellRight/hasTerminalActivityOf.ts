import type { AppState } from '../../../store/types';
import {
  sessionTerminalOwner,
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../../store/slices/terminal/terminalOwner';
import type { TerminalTab } from '../../../shared/types/terminal';

type Params = {
  readonly state: Pick<
    AppState,
    'terminalTabs' | 'terminalFinishes' | 'currentSessionId' | 'currentWorkspaceId'
  >;
};

const NO_TABS: Readonly<Record<string, ReadonlyArray<TerminalTab>>> = {};

export const hasTerminalActivityOf = ({ state }: Params): boolean => {
  const sessionId = state.currentSessionId;
  const workspaceId = state.currentWorkspaceId;
  const tabs = state.terminalTabs ?? NO_TABS;
  const scoped = [
    ...(sessionId === null
      ? []
      : (tabs[terminalOwnerKey({ owner: sessionTerminalOwner({ sessionId }) })] ?? [])),
    ...(workspaceId === null
      ? []
      : (tabs[terminalOwnerKey({ owner: workspaceTerminalOwner({ workspaceId }) })] ?? [])),
  ];
  const finishes = state.terminalFinishes ?? {};
  return (
    scoped.some((tab) => tab.status === 'attention') ||
    (sessionId !== null && finishes[sessionId] != null)
  );
};
