import { ErrorStrip, PANE_RHYTHM, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionLoading } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { LevelFolder } from './LevelFolder';
import { LevelLinked } from './LevelLinked';
import { LevelProjects } from './LevelProjects';
import { LevelSkeleton } from './LevelSkeleton';

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionLevel = ({ session, isActive }: Props) => {
  const sessionId = session.id;
  const isLoading = useSessionLoading(sessionId).agents;
  const agentsError = useAppStore((state) => state.sessionAgentsError[sessionId] ?? null);
  const openSessionAgents = useAppStore((state) => state.openSessionAgents);
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );

  return (
    <div data-session-level="" className={cn('flex min-w-0 flex-col', PANE_RHYTHM.block)}>
      <ErrorStrip
        labels={["this session's agents"]}
        error={agentsError === null ? null : new Error(agentsError)}
        onRetry={() => void openSessionAgents({ sessionId })}
      />
      {isLoading ? (
        <LevelSkeleton />
      ) : (
        <div data-level-cards="" className={cn('flex flex-col', PANE_RHYTHM.block)}>
          {isBranchless ? (
            <LevelFolder session={session} />
          ) : (
            <LevelProjects session={session} isActive={isActive} />
          )}
          <LevelLinked session={session} isActive={isActive} />
        </div>
      )}
    </div>
  );
};
