import type { ComponentProps } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { supportedLens } from '../../../session/supportedLens';
import { useCardPages } from '../../hooks/useCardPages';
import { currentSignOf } from './currentSign';
import { SessionActivityItem } from './SessionActivityItem';
import { SessionPages } from './SessionPages';
import { SESSION_CARD_CLASS } from './sessionCard';

type ItemProps = ComponentProps<typeof SessionActivityItem>;

type Props = Omit<ItemProps, 'sign' | 'isPagesFolded' | 'onPagesFoldChange' | 'isActive'> & {
  readonly session: Session;
  readonly hasStudioOver: boolean;
};

export const OpenSessionCard = ({ session, hasStudioOver, ...item }: Props) => {
  const sessionId = session.id as SessionId;
  const isFolded = useAppStore((state) => state.sessionPagesFolded[sessionId] ?? false);
  const setSessionPagesFolded = useAppStore((state) => state.setSessionPagesFolded);
  const storedLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const { pages, summaries } = useCardPages({ session });
  const activeLens = supportedLens({ lens: storedLens, isBranchless });
  const sign = currentSignOf({
    activeLens,
    pages: isFolded ? [] : pages,
    hasStudioOver,
  });

  return (
    <div data-session-card className={SESSION_CARD_CLASS}>
      <SessionActivityItem
        {...item}
        session={session}
        isActive
        sign={sign}
        isPagesFolded={isFolded}
        onPagesFoldChange={(next) => setSessionPagesFolded({ sessionId, isFolded: next })}
      />
      {isFolded ? null : (
        <SessionPages session={session} pages={pages} summaries={summaries} sign={sign} />
      )}
    </div>
  );
};
