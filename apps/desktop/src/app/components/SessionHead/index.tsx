import { useContext } from 'react';
import { PageColumn, PANE_RHYTHM, PaneTitleRow, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { isTabView } from '../../../store/slices/navigation/isTabView';
import { OverviewTitle } from '../../../features/session/components/SessionOverviewPane/OverviewTitle';
import { SessionHeadSlotsContext } from '../../../features/session/sessionHeadSlotsContext';
import { SessionPageTabs } from '../SessionPageTabs';
import { SessionBackButton } from './SessionBackButton';
import { SessionCrumbs } from './SessionCrumbs';
import { SessionHeadActions } from './SessionHeadActions';

type Props = {
  readonly session: Session;
};

export const SessionHead = ({ session }: Props) => {
  const sessionId = session.id;
  const slots = useContext(SessionHeadSlotsContext);
  const isDetail = useAppStore((state) => {
    const { place } = captureLocation({ state });
    return (
      place.at === 'session' && place.sessionId === sessionId && !isTabView({ view: place.view })
    );
  });
  return (
    <PageColumn width="column">
      <header
        data-session-head=""
        data-head-nav={isDetail ? 'crumbs' : 'tabs'}
        className={cn(
          'flex min-w-0 shrink-0 flex-col',
          PANE_RHYTHM.head.rows,
          PANE_RHYTHM.headerInset,
        )}
      >
        <PaneTitleRow
          leading={isDetail ? <SessionBackButton sessionId={sessionId} /> : null}
          title={<OverviewTitle session={session} />}
          isHeading={!isDetail || slots?.isHeadingClaimed === true}
          actions={<SessionHeadActions session={session} isDetail={isDetail} />}
        />
        <div className="flex min-w-0 items-center gap-3">
          {isDetail ? (
            <SessionCrumbs session={session} />
          ) : (
            <div className="flex min-w-0 flex-1 flex-col">
              <SessionPageTabs session={session} />
            </div>
          )}
          {isDetail && slots !== null ? (
            <div
              ref={slots.setMeta}
              data-session-head-meta=""
              className="flex shrink-0 items-center gap-2 empty:hidden"
            />
          ) : null}
        </div>
      </header>
    </PageColumn>
  );
};
