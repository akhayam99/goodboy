import type { Session } from '@goodboy/types';
import type { OverviewGlance } from '../../central/overviewGlanceOf';
import { OverviewGlanceLine } from '../../central/summary/OverviewGlanceLine';
import { SummaryStateLine } from '../../central/summary/SummaryStateLine';
import { ChatOriginRow } from './ChatOriginRow';

type Props = {
  readonly session: Session;
  readonly glance: OverviewGlance | null;
};

export const OverviewStatusBlock = ({ session, glance }: Props) => (
  <div data-overview-status="" className="flex min-w-0 flex-col gap-1 empty:hidden">
    {glance === null ? null : <OverviewGlanceLine glance={glance} />}
    {glance === null ? null : <SummaryStateLine sessionId={session.id} />}
    <ChatOriginRow session={session} />
  </div>
);
