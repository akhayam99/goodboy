import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';

type Props = {
  readonly level: SidebarLevel;
  readonly workspace: ReactNode;
  readonly session: ReactNode;
};

const LAYER =
  'absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-180 motion-safe:ease-out';

export const LevelStack = ({ level, workspace, session }: Props) => {
  const isSession = level === 'session' && session !== null;
  return (
    <div
      data-level-stack={isSession ? 'session' : 'workspace'}
      className="relative min-h-0 flex-1 overflow-hidden"
    >
      <div
        data-level-layer="workspace"
        inert={isSession}
        style={{ visibility: isSession ? 'hidden' : 'visible' }}
        className={cn(
          LAYER,
          isSession ? 'pointer-events-none -translate-x-full opacity-0' : 'opacity-100',
        )}
      >
        {workspace}
      </div>
      {session === null ? null : (
        <div
          data-level-layer="session"
          inert={!isSession}
          style={{ visibility: isSession ? 'visible' : 'hidden' }}
          className={cn(
            LAYER,
            isSession ? 'opacity-100' : 'pointer-events-none translate-x-full opacity-0',
          )}
        >
          {session}
        </div>
      )}
    </div>
  );
};
