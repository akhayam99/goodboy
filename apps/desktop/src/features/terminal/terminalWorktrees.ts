import type {
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import type { TerminalSelection, TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import { projectById } from '../../store/slices/projects/projectIndex';
import { folderName } from '../../store/slices/terminal/terminalOwner';
import { mountOfTab, terminalWorktreeKey } from '../../store/slices/terminal/terminalWorktree';
import { sessionTitle } from '../../shared/utils/sessionTitle';

export type TerminalWorktree = {
  readonly key: string;
  readonly kind: 'workspace' | 'mount' | 'path';
  readonly sessionId: SessionId | null;
  readonly projectId: ProjectId | null;
  readonly projectName: string;
  readonly branch: string | null;
  readonly path: string | null;
  readonly folder: string | null;
  readonly tabs: ReadonlyArray<TerminalTab>;
};

export type TerminalGroup = {
  readonly key: string;
  readonly kind: 'workspace' | 'session' | 'archived';
  readonly sessionId: SessionId | null;
  readonly title: string;
  readonly worktrees: ReadonlyArray<TerminalWorktree>;
};

type GroupsParams = {
  readonly workspaceId: WorkspaceId;
  readonly terminalTabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedSessions: ReadonlyArray<Session>;
  readonly mountsBySession: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly projects: ReadonlyArray<Pick<Project, 'id' | 'name'>>;
};

type BuildParams = {
  readonly tabs: ReadonlyArray<TerminalTab>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Pick<Project, 'id' | 'name'>>;
};

type SelectParams = {
  readonly groups: ReadonlyArray<TerminalGroup>;
  readonly selection: TerminalSelection;
  readonly focusSessionId: SessionId | null;
};

type ActiveParams = {
  readonly worktree: TerminalWorktree;
  readonly active: Readonly<Record<string, TerminalTabId>>;
  readonly terminalId: TerminalTabId | null;
};

const WORKSPACE_GROUP_KEY = 'workspace';
export const ARCHIVED_GROUP_KEY = 'archived';
const ARCHIVED_GROUP_TITLE = 'Archived sessions';
const WORKSPACE_GROUP_TITLE = 'Workspace folder';
const UNKNOWN_FOLDER_NAME = 'Terminal';

const terminalWorktreesOf = ({
  tabs,
  mounts,
  projects,
}: BuildParams): ReadonlyArray<TerminalWorktree> => {
  const order: string[] = [];
  const byKey = new Map<string, TerminalTab[]>();
  for (const tab of tabs) {
    const key = terminalWorktreeKey({ tab, mounts });
    const bucket = byKey.get(key);
    if (bucket === undefined) {
      order.push(key);
      byKey.set(key, [tab]);
      continue;
    }
    bucket.push(tab);
  }
  return order.map((key) => {
    const bucket = byKey.get(key) ?? [];
    const first = bucket[0];
    if (first === undefined) {
      throw new Error('empty terminal worktree bucket');
    }
    const mount = mountOfTab({ tab: first, mounts });
    const path = mount?.worktreePath ?? first.cwd;
    const projectId = mount?.projectId ?? first.projectId ?? null;
    const projectName =
      mount === null
        ? (folderName({ path }) ?? UNKNOWN_FOLDER_NAME)
        : (projectById(projects, mount.projectId)?.name ?? mount.mountName);
    return {
      key,
      kind: first.owner.kind === 'workspace' ? 'workspace' : mount === null ? 'path' : 'mount',
      sessionId: first.owner.kind === 'session' ? first.owner.sessionId : null,
      projectId,
      projectName,
      branch: mount?.branch ?? null,
      path,
      folder: folderName({ path }),
      tabs: bucket,
    };
  });
};

export const terminalGroups = ({
  workspaceId,
  terminalTabs,
  sessions,
  archivedSessions,
  mountsBySession,
  projects,
}: GroupsParams): ReadonlyArray<TerminalGroup> => {
  const groups: TerminalGroup[] = [];
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
      worktrees: terminalWorktreesOf({ tabs, mounts: mountsBySession[session.id] ?? [], projects }),
    });
  }
  const archivedWorktrees = archivedSessions.flatMap((session) => {
    const tabs = terminalTabs[session.id] ?? [];
    if (session.workspaceId !== workspaceId || tabs.length === 0) {
      return [];
    }
    return terminalWorktreesOf({ tabs, mounts: mountsBySession[session.id] ?? [], projects });
  });
  if (archivedWorktrees.length > 0) {
    groups.push({
      key: ARCHIVED_GROUP_KEY,
      kind: 'archived',
      sessionId: null,
      title: ARCHIVED_GROUP_TITLE,
      worktrees: archivedWorktrees,
    });
  }
  const workspaceTabs = terminalTabs[`ws:${workspaceId}`] ?? [];
  if (workspaceTabs.length > 0) {
    groups.push({
      key: WORKSPACE_GROUP_KEY,
      kind: 'workspace',
      sessionId: null,
      title: WORKSPACE_GROUP_TITLE,
      worktrees: terminalWorktreesOf({ tabs: workspaceTabs, mounts: [], projects }),
    });
  }
  return groups;
};

export const allWorktrees = ({
  groups,
}: {
  readonly groups: ReadonlyArray<TerminalGroup>;
}): ReadonlyArray<TerminalWorktree> => groups.flatMap((group) => group.worktrees);

export const selectedWorktree = ({
  groups,
  selection,
  focusSessionId,
}: SelectParams): TerminalWorktree | null => {
  const all = allWorktrees({ groups });
  const byKey = all.find((worktree) => worktree.key === selection.worktree);
  if (byKey !== undefined) {
    return byKey;
  }
  const byTab = all.find((worktree) =>
    worktree.tabs.some((tab) => tab.id === selection.terminalId),
  );
  if (byTab !== undefined) {
    return byTab;
  }
  const focused = groups.find(
    (group) => group.sessionId !== null && group.sessionId === focusSessionId,
  );
  return focused?.worktrees[0] ?? all[0] ?? null;
};

export const activeTabOf = ({ worktree, active, terminalId }: ActiveParams): TerminalTab | null => {
  const picked = worktree.tabs.find((tab) => tab.id === terminalId);
  if (picked !== undefined) {
    return picked;
  }
  const remembered = worktree.tabs.find((tab) => tab.id === active[worktree.key]);
  return remembered ?? worktree.tabs[0] ?? null;
};
