import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalShell } from '../../../features/terminal/terminal';
import type { TerminalSelection, TerminalTab, TerminalTabId } from '../../../shared/types/terminal';

export const SETTING_TERMINAL_NAMES = 'terminal.names';

type FolderKeyParams = {
  readonly workspaceId: WorkspaceId;
};

export const settingTerminalFolder = ({ workspaceId }: FolderKeyParams) =>
  `terminal.workspaceFolder.${workspaceId}`;

export type TerminalState = {
  readonly terminalSessions: Readonly<Record<SessionId, 'open' | 'closed'>>;
  readonly terminalTabs: Readonly<Record<string, readonly TerminalTab[]>>;
  readonly activeTerminalTab: Readonly<Record<string, TerminalTabId | null>>;
  readonly terminalWorktreeActive: Readonly<Record<string, TerminalTabId>>;
  readonly terminalSelection: TerminalSelection | null;
  readonly terminalNames: Readonly<Record<string, string>>;
  readonly terminalOrdinals: Readonly<Record<string, number>>;
  readonly terminalFolderOverrides: Readonly<Record<WorkspaceId, string | null>>;
  readonly terminalScopes: Readonly<Record<SessionId, string>>;
  readonly detectedShells: ReadonlyArray<TerminalShell> | null;
};

export const terminalInitialState: TerminalState = {
  terminalSessions: {},
  terminalTabs: {},
  activeTerminalTab: {},
  terminalWorktreeActive: {},
  terminalSelection: null,
  terminalNames: {},
  terminalOrdinals: {},
  terminalFolderOverrides: {},
  terminalScopes: {},
  detectedShells: null,
};
