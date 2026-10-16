import { ScrollFade } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { useSessionPageLens } from '../../../../features/session/hooks/useSessionPageLens';
import { currentSignOf } from '../../../../features/workspace/components/SessionActivityBar/currentSign';
import { SessionPages } from '../../../../features/workspace/components/SessionActivityBar/SessionPages';
import { useCardPages } from '../../../../features/workspace/hooks/useCardPages';
import { LevelLinked } from './LevelLinked';
import { LevelProjects } from './LevelProjects';

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionLevel = ({ session, isActive }: Props) => {
  const sessionId = session.id;
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
        <div className="flex flex-col gap-4 px-2 pb-2">
          <SessionPages session={session} pages={pages} facts={facts} sign={sign} />
          {isBranchless ? null : <LevelProjects session={session} isActive={isActive} />}
          <LevelLinked session={session} isActive={isActive} />
        </div>
      </ScrollFade>
    </div>
  );
};
