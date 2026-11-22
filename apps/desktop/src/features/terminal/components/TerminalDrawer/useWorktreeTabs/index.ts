import { useCallback, useMemo } from 'react';
import type { Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { openSessionTerminal } from '../../../openSessionTerminal';
import { worktreeTabsOf, type WorktreeTab } from '../../../worktreeTabsOf';

type Params = {
  readonly sessionId: SessionId | null;
  readonly isBranchless: boolean;
};

type PickParams = {
  readonly tab: WorktreeTab;
};

type WorktreeTabs = {
  readonly session: Session | null;
  readonly tabs: ReadonlyArray<WorktreeTab>;
  readonly pick: (params: PickParams) => void;
};

const NO_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

const NO_TABS: ReadonlyArray<WorktreeTab> = [];

export const useWorktreeTabs = ({ sessionId, isBranchless }: Params): WorktreeTabs => {
  const session = useAppStore((state) =>
    sessionId === null ? null : (sessionById(state.sessions, sessionId) ?? null),
  );
  const mounts = useAppStore((state) =>
    sessionId === null ? NO_MOUNTS : (state.sessionProjectMounts[sessionId] ?? NO_MOUNTS),
  );
  const projects = useAppStore((state) => state.projects);
  const tabs = useMemo(
    () => (isBranchless ? NO_TABS : worktreeTabsOf({ mounts, projects })),
    [isBranchless, mounts, projects],
  );
  const pick = useCallback(
    ({ tab }: PickParams) => {
      if (sessionId === null) {
        return;
      }
      openSessionTerminal({ state: useAppStore.getState(), sessionId, cwd: tab.path });
    },
    [sessionId],
  );
  return { session, tabs, pick };
};
