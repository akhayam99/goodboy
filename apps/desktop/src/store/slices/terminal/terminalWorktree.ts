import type { SessionProjectMount } from '@goodboy/types';
import type { TerminalTab } from '../../../shared/types/terminal';
import type { AppStore } from '../../store';
import { terminalOwnerKey } from './terminalOwner';

const WORKSPACE_KEY_PREFIX = 'ws:';
const MOUNT_SEGMENT = '#m:';
const PATH_SEGMENT = '#p:';
const NONE_SEGMENT = '#none';

type MountOfTabParams = {
  readonly tab: TerminalTab;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

export const mountOfTab = ({ tab, mounts }: MountOfTabParams): SessionProjectMount | null => {
  if (tab.owner.kind !== 'session') {
    return null;
  }
  const byId =
    tab.mountId === undefined
      ? undefined
      : mounts.find((candidate) => candidate.mountId === tab.mountId);
  if (byId !== undefined && (tab.cwd === null || tab.cwd === byId.worktreePath)) {
    return byId;
  }
  if (tab.cwd === null) {
    return null;
  }
  return mounts.find((candidate) => candidate.worktreePath === tab.cwd) ?? null;
};

export const terminalWorktreeKey = ({ tab, mounts }: MountOfTabParams): string => {
  if (tab.owner.kind === 'workspace') {
    return `${WORKSPACE_KEY_PREFIX}${tab.owner.workspaceId}`;
  }
  const { sessionId } = tab.owner;
  const mount = mountOfTab({ tab, mounts });
  if (mount !== null) {
    return `${sessionId}${MOUNT_SEGMENT}${mount.mountId}`;
  }
  if (tab.cwd !== null) {
    return `${sessionId}${PATH_SEGMENT}${tab.cwd}`;
  }
  return `${sessionId}${NONE_SEGMENT}`;
};

type StateTabParams = {
  readonly state: Pick<AppStore, 'sessionProjectMounts'>;
  readonly tab: TerminalTab;
};

export const terminalWorktreeKeyIn = ({ state, tab }: StateTabParams): string =>
  terminalWorktreeKey({
    tab,
    mounts:
      tab.owner.kind === 'session' ? (state.sessionProjectMounts[tab.owner.sessionId] ?? []) : [],
  });

type FindParams = {
  readonly state: Pick<AppStore, 'sessionProjectMounts' | 'terminalTabs'>;
  readonly tabId: string;
};

export const findTerminalTab = ({ state, tabId }: FindParams): TerminalTab | null => {
  for (const tabs of Object.values(state.terminalTabs)) {
    const found = tabs.find((candidate) => candidate.id === tabId);
    if (found !== undefined) {
      return found;
    }
  }
  return null;
};

type SiblingsParams = {
  readonly state: Pick<AppStore, 'sessionProjectMounts' | 'terminalTabs'>;
  readonly tab: TerminalTab;
};

export const worktreeSiblings = ({ state, tab }: SiblingsParams): ReadonlyArray<TerminalTab> => {
  const key = terminalWorktreeKeyIn({ state, tab });
  return (state.terminalTabs[terminalOwnerKey({ owner: tab.owner })] ?? []).filter(
    (candidate) => terminalWorktreeKeyIn({ state, tab: candidate }) === key,
  );
};
