import { inlineMarkdownText } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
import { SessionPages } from '../../../features/workspace/components/SessionActivityBar/SessionPages';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';
import { useSessionRowFacts } from '../../../features/workspace/hooks/useSessionRowFacts';
import { useSessionPageLens } from '../../../features/session/hooks/useSessionPageLens';

type Props = {
  readonly session: Session;
  readonly hasStudioOver: boolean;
};

export const RailFlyoutSession = ({ session, hasStudioOver }: Props) => {
  const sessionId = session.id as SessionId;
  const { summary, title } = useSessionRowFacts({ session });
  const { pages, facts } = useCardPages({ session });
  const pageLens = useSessionPageLens({ session });
  const sign = currentSignOf({
    activeLens: pageLens,
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
