import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../shared/types/terminal';

export type TerminalState = {
  readonly terminalSessions: Readonly<Record<SessionId, 'open' | 'closed'>>;
  readonly terminalTabs: Readonly<Record<SessionId, readonly TerminalTab[]>>;
  readonly activeTerminalTab: Readonly<Record<SessionId, TerminalTabId | null>>;
};

export const terminalInitialState: TerminalState = {
  terminalSessions: {},
  terminalTabs: {},
  activeTerminalTab: {},
};
