import { inlineMarkdownText } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
import { SessionPages } from '../../../features/workspace/components/SessionActivityBar/SessionPages';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';
import { useSessionSummary } from '../../../features/workspace/hooks/useSessionSummary';
import { sessionRowTitle } from '../../../features/session/sessionTitle';
import { supportedLens } from '../../../features/session/supportedLens';

type Props = {
  readonly session: Session;
  readonly hasStudioOver: boolean;
};

export const RailFlyoutSession = ({ session, hasStudioOver }: Props) => {
  const sessionId = session.id as SessionId;
  const summary = useSessionSummary({ session });
  const { title } = sessionRowTitle({ session, tasks: summary.tasks });
  const { pages, facts } = useCardPages({ session });
  const storedLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const sign = currentSignOf({
    activeLens: supportedLens({ lens: storedLens, isBranchless }),
    pages,
    hasStudioOver,
  });
  const words = summary.words ?? summary.reason;

  return (
    <div className="flex flex-col gap-1" data-slot="rail-flyout-session">
      <div className="flex min-w-0 flex-col px-2 pb-1 pt-1">
        <span className="truncate text-row text-foreground">
          {inlineMarkdownText({ text: title })}
        </span>
        {words === '' ? null : (
          <span className="truncate text-meta text-faint-foreground">{words}</span>
        )}
      </div>
      <SessionPages session={session} pages={pages} facts={facts} sign={sign} />
    </div>
  );
};
