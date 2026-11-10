import { useAppStore } from '../../../store';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import type { Session } from '@goodboy/types';
import { useSessionPageLens } from '../../../features/session/hooks/useSessionPageLens';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';

import { RailWorktrees } from './RailWorktrees';
import { SessionPages } from './SessionPages';

type Props = {
  readonly session: Session;
};

export const RailSessionLevel = ({ session }: Props) => {
  const sessionId = session.id;
  const { pages, facts } = useCardPages({ session });
  const pageLens = useSessionPageLens({ session });
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const sign = currentSignOf({
    activeLens: pageLens,
    pages,
    hasStudioOver: false,
  });

  return (
    <div data-rail-level="session" className="flex flex-col gap-1 px-2">
      <SessionPages session={session} pages={pages} facts={facts} sign={sign} variant="icon" />
      {isBranchless ? null : <RailWorktrees session={session} />}
    </div>
  );
};
