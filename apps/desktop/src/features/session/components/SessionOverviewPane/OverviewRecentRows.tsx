import { useDeferredValue } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useExplodeGroups } from '../../hooks/useExplodeGroups';
import { TimelineRow } from '../SessionWorkspace/parts/TimelinePane/TimelineRow';
import { TimelineSkeleton } from '../SessionWorkspace/parts/TimelinePane/TimelineSkeleton';
import { useTimelineRowProps } from '../SessionWorkspace/parts/TimelinePane/useTimelineRowProps';
import { useTimelineRows } from '../SessionWorkspace/parts/TimelinePane/useTimelineRows';

type Props = {
  readonly session: Session;
};

const RECENT_ROWS = 3;

export const OverviewRecentRows = ({ session }: Props) => {
  const explode = useExplodeGroups();
  const drawnSessionId = useDeferredValue<SessionId | null>(session.id, null);
  const rows = useTimelineRows({ session, view: 'all', query: '', explode });
  const { rowPropsFor } = useTimelineRowProps({ session, explode, rows });
  if (drawnSessionId !== session.id || (!rows.isLoaded && rows.entries.length === 0)) {
    return <TimelineSkeleton />;
  }
  const items = rows.laidOutItems.filter((item) => item.kind === 'row').slice(0, RECENT_ROWS);
  return (
    <div data-overview-recent="" className="@container flex min-w-0 flex-col">
      {items.map((item, index) => {
        const props = rowPropsFor({ item, index });
        return props === null ? null : (
          <div key={item.id} data-log-row="">
            <TimelineRow {...props} />
          </div>
        );
      })}
    </div>
  );
};
