import { ErrorStrip, ScrollFade, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionLoading } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { useSessionPageLens } from '../../../../features/session/hooks/useSessionPageLens';
import { currentSignOf } from '../../../../features/workspace/components/SessionActivityBar/currentSign';
import { useCardPages } from '../../../../features/workspace/hooks/useCardPages';
import { SessionPages } from '../SessionPages';
import { LevelFolder } from './LevelFolder';
import { LevelLinked } from './LevelLinked';
import { LevelProjects } from './LevelProjects';
import { LevelSkeleton } from './LevelSkeleton';
import { RAIL_INSET } from './railInset';

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionLevel = ({ session, isActive }: Props) => {
  const sessionId = session.id;
  const isLoading = useSessionLoading(sessionId).agents;
  const agentsError = useAppStore((state) => state.sessionAgentsError[sessionId] ?? null);
  const openSessionAgents = useAppStore((state) => state.openSessionAgents);
  const { pages, facts } = useCardPages({ session });
  const pageLens = useSessionPageLens({ session });
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const sign = currentSignOf({
    activeLens: pageLens,
    pages,
    hasStudioOver: !isActive,
  });

  return (
    <div data-session-level="" className="flex min-h-0 flex-1 flex-col gap-1">
      <ScrollFade className="min-h-0 flex-1">
        <div className={cn('flex flex-col gap-4 pb-2', RAIL_INSET)}>
          <div className="flex flex-col">
            <SessionPages session={session} pages={pages} facts={facts} sign={sign} />
          </div>
          <ErrorStrip
            label="this session's agents"
            error={agentsError === null ? null : new Error(agentsError)}
            onRetry={() => void openSessionAgents({ sessionId })}
          />
          {isLoading ? (
            <LevelSkeleton />
          ) : (
            <div data-level-cards="" className="flex flex-col gap-4">
              {isBranchless ? (
                <LevelFolder session={session} />
              ) : (
                <LevelProjects session={session} isActive={isActive} />
              )}
              <LevelLinked session={session} isActive={isActive} />
            </div>
          )}
        </div>
      </ScrollFade>
    </div>
  );
};
