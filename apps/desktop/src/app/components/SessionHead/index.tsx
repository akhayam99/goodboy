import { PageColumn, PANE_RHYTHM, PaneTitleRow, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { isTabView } from '../../../store/slices/navigation/isTabView';
import { OverviewTitle } from '../../../features/session/components/SessionOverviewPane/OverviewTitle';
import { SessionPageTabs } from '../SessionPageTabs';
import { SessionCrumbs } from './SessionCrumbs';
import { SessionHeadActions } from './SessionHeadActions';

type Props = {
  readonly session: Session;
};

export const SessionHead = ({ session }: Props) => {
  const sessionId = session.id;
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
        className={cn('flex min-w-0 shrink-0 flex-col gap-2', PANE_RHYTHM.headerInset)}
      >
        <PaneTitleRow
          title={<OverviewTitle session={session} />}
          isHeading={!isDetail}
          actions={<SessionHeadActions session={session} />}
        />
        <div className="flex min-w-0 items-center">
          {isDetail ? <SessionCrumbs session={session} /> : <SessionPageTabs session={session} />}
        </div>
      </header>
    </PageColumn>
  );
};
