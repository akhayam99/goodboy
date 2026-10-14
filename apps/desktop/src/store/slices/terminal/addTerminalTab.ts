import type { MountId, ProjectId } from '@goodboy/types';
import { selectActiveMount, selectMountForPath } from '../project-mounts/selectors';
import type { TerminalOwner, TerminalTab, TerminalTabId } from '../../../shared/types/terminal';
import { nextTerminalTitle, terminalOwnerKey, terminalTabIdOf } from './terminalOwner';
import { terminalWorktreeKeyIn } from './terminalWorktree';
import { saveTerminalTabs } from './saveTerminalTabs';
import type { GetFn, SetFn } from './types';

type AddParams = {
  readonly owner: TerminalOwner;
  readonly cwd: string | null;
};

type ScopeParams = {
  readonly tabs: readonly TerminalTab[];
};

const nextOrdinal = ({ tabs }: ScopeParams): number => {
  let max = 0;
  for (const tab of tabs) {
    const trailing = Number.parseInt(tab.id.slice(tab.id.lastIndexOf('t') + 1), 10);
    const ordinal = Number.isNaN(trailing) ? 1 : trailing;
    if (ordinal > max) {
      max = ordinal;
    }
  }
  return max + 1;
};

type Scope = {
  readonly projectId?: ProjectId;
  readonly mountId?: MountId;
};

type ScopeOfParams = {
  readonly state: ReturnType<GetFn>;
  readonly owner: TerminalOwner;
  readonly cwd: string | null;
};

const scopeOf = ({ state, owner, cwd }: ScopeOfParams): Scope => {
  if (owner.kind === 'workspace') {
    return {};
  }
  const { sessionId } = owner;
  const mount =
    selectMountForPath({ state, sessionId, path: cwd }) ?? selectActiveMount({ state, sessionId });
  return {
    ...(mount?.projectId === undefined ? {} : { projectId: mount.projectId }),
    ...(mount?.mountId === undefined ? {} : { mountId: mount.mountId }),
  };
};

export const addTerminalTab = (set: SetFn, get: GetFn) => {
  return ({ owner, cwd }: AddParams): TerminalTabId => {
    const key = terminalOwnerKey({ owner });
    const tabs = get().terminalTabs[key] ?? [];
    const id = terminalTabIdOf({ owner, ordinal: nextOrdinal({ tabs }) });
    const draft: TerminalTab = {
      id,
      owner,
      title: nextTerminalTitle({ titles: [] }),
      cwd,
      ...scopeOf({ state: get(), owner, cwd }),
      status: 'running',
      createdAt: Date.now(),
    };
    const worktree = terminalWorktreeKeyIn({ state: get(), tab: draft });
    const tab: TerminalTab = {
      ...draft,
      title: nextTerminalTitle({
        titles: tabs
          .filter(
            (candidate) => terminalWorktreeKeyIn({ state: get(), tab: candidate }) === worktree,
          )
          .map((candidate) => candidate.title),
      }),
    };
    set((s) => ({
      terminalTabs: { ...s.terminalTabs, [key]: [...tabs, tab] },
      activeTerminalTab: { ...s.activeTerminalTab, [key]: id },
      terminalWorktreeActive: { ...s.terminalWorktreeActive, [worktree]: id },
    }));
    saveTerminalTabs({ get });
    return id;
  };
};
