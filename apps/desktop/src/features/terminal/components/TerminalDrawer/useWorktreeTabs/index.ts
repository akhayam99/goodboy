import { useMemo } from 'react';
import type { Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { worktreeTabsOf, type WorktreeTab } from '../../../worktreeTabsOf';

type Params = {
  readonly sessionId: SessionId | null;
  readonly isBranchless: boolean;
};

type WorktreeTabs = {
  readonly session: Session | null;
  readonly tabs: ReadonlyArray<WorktreeTab>;
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
  return { session, tabs };
};
