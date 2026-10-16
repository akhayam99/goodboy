import type { ReactNode } from 'react';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';
import { LevelLayer } from './LevelLayer';

type Props = {
  readonly level: SidebarLevel;
  readonly workspace: ReactNode;
  readonly session: ReactNode;
  readonly worktree?: ReactNode;
};

type ShownParams = Pick<Props, 'level'> & {
  readonly hasSession: boolean;
  readonly hasWorktree: boolean;
};

const DEPTH: Readonly<Record<SidebarLevel, number>> = {
  workspace: 0,
  session: 1,
  worktree: 2,
};

const shownLevelOf = ({ level, hasSession, hasWorktree }: ShownParams): SidebarLevel => {
  if (!hasSession || level === 'workspace') {
    return 'workspace';
  }
  if (level === 'worktree' && hasWorktree) {
    return 'worktree';
  }
  return 'session';
};

export const LevelStack = ({ level, workspace, session, worktree = null }: Props) => {
  const hasSession = session !== null;
  const hasWorktree = hasSession && worktree !== null;
  const shown = shownLevelOf({ level, hasSession, hasWorktree });
  const shownDepth = DEPTH[shown];
  return (
    <div data-level-stack={shown} className="relative min-h-0 flex-1 overflow-hidden">
      <LevelLayer name="workspace" depth={DEPTH.workspace} shownDepth={shownDepth}>
        {workspace}
      </LevelLayer>
      {hasSession ? (
        <LevelLayer name="session" depth={DEPTH.session} shownDepth={shownDepth}>
          {session}
        </LevelLayer>
      ) : null}
      {hasWorktree ? (
        <LevelLayer name="worktree" depth={DEPTH.worktree} shownDepth={shownDepth}>
          {worktree}
        </LevelLayer>
      ) : null}
    </div>
  );
};
