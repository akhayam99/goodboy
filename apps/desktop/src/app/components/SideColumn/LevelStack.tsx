import type { ReactNode } from 'react';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';
import { LevelLayer } from './LevelLayer';

type Props = {
  readonly level: SidebarLevel;
  readonly workspace: ReactNode;
  readonly session: ReactNode;
  readonly auto?: ReactNode;
};

type ShownParams = {
  readonly level: SidebarLevel;
  readonly session: ReactNode;
  readonly auto: ReactNode;
};

const shownLevelOf = ({ level, session, auto }: ShownParams): SidebarLevel => {
  if (level === 'auto' && auto !== null) {
    return 'auto';
  }
  if (level !== 'workspace' && session !== null) {
    return 'session';
  }
  return 'workspace';
};

export const LevelStack = ({ level, workspace, session, auto = null }: Props) => {
  const shown = shownLevelOf({ level, session, auto });
  return (
    <div data-level-stack={shown} className="relative min-h-0 flex-1 overflow-hidden">
      <LevelLayer layer="workspace" shown={shown}>
        {workspace}
      </LevelLayer>
      {session === null ? null : (
        <LevelLayer layer="session" shown={shown}>
          {session}
        </LevelLayer>
      )}
      {auto === null ? null : (
        <LevelLayer layer="auto" shown={shown}>
          {auto}
        </LevelLayer>
      )}
    </div>
  );
};
