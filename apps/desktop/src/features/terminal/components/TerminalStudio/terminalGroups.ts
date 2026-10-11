import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import type { AppStore } from '../../../../store/store';
import { sessionTitle } from '../../../session/sessionTitle';

export type TerminalGroup = {
  readonly key: string;
  readonly kind: 'workspace' | 'session';
  readonly sessionId: SessionId | null;
  readonly title: string;
  readonly branch: string | null;
  readonly tabs: ReadonlyArray<TerminalTab>;
};

type GroupsParams = {
  readonly workspaceId: WorkspaceId;
  readonly terminalTabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
  readonly sessions: ReadonlyArray<Session>;
  readonly branches: Readonly<Record<string, string | null>>;
};

type SelectParams = {
  readonly groups: ReadonlyArray<TerminalGroup>;
  readonly selectedId: TerminalTabId | null;
  readonly focusSessionId: SessionId | null;
};

export const WORKSPACE_GROUP_KEY = 'workspace';
export const WORKSPACE_GROUP_TITLE = 'Workspace';

export const terminalGroups = ({
  workspaceId,
  terminalTabs,
  sessions,
  branches,
}: GroupsParams): ReadonlyArray<TerminalGroup> => {
  const groups: TerminalGroup[] = [];
  const workspaceTabs = terminalTabs[`ws:${workspaceId}`] ?? [];
  if (workspaceTabs.length > 0) {
    groups.push({
      key: WORKSPACE_GROUP_KEY,
      kind: 'workspace',
      sessionId: null,
      title: WORKSPACE_GROUP_TITLE,
      branch: null,
      tabs: workspaceTabs,
    });
  }
  for (const session of sessions) {
    const tabs = terminalTabs[session.id] ?? [];
    if (session.workspaceId !== workspaceId || tabs.length === 0) {
      continue;
    }
    groups.push({
      key: session.id,
      kind: 'session',
      sessionId: session.id,
      title: sessionTitle({ session }),
      branch: branches[session.id] ?? null,
      tabs,
    });
  }
  return groups;
};

export const selectedTerminal = ({
  groups,
  selectedId,
  focusSessionId,
}: SelectParams): TerminalTab | null => {
  const all = groups.flatMap((group) => group.tabs);
  const picked = all.find((tab) => tab.id === selectedId);
  if (picked !== undefined) {
    return picked;
  }
  const focused = groups.find(
    (group) => group.sessionId !== null && group.sessionId === focusSessionId,
  );
  return focused?.tabs[0] ?? all[0] ?? null;
};

type BranchesParams = {
  readonly state: Pick<AppStore, 'terminalTabs' | 'sessionProjectMounts'>;
};

export const terminalSessionBranches = ({
  state,
}: BranchesParams): Readonly<Record<string, string | null>> =>
  Object.fromEntries(
    Object.keys(state.terminalTabs).map((key) => [
      key,
      state.sessionProjectMounts[key]?.[0]?.branch ?? null,
    ]),
  );
