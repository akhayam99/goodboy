import { useCallback, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useRowPreload } from '../../../../shared/hooks/useRowPreload';
import { countNoun } from '../../../../shared/utils/countNoun';
import { scrollParentOf } from '../../../../shared/utils/scrollParentOf';
import { countRowIdOf } from '../../timeline/buildTimelineStream';
import { useExplodeGroups, type ExplodeGroups } from '../../hooks/useExplodeGroups';
import { useScrollAnchor } from '../../hooks/useScrollAnchor';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { TimelineEmpty } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineEmpty';
import { TimelineRevealRow } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineRevealRow';
import { TimelineRow } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineRow';
import { TimelineSkeleton } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineSkeleton';
import { useTimelineRowProps } from '../../components/SessionWorkspace/parts/TimelinePane/useTimelineRowProps';
import { useTimelineRows } from '../../components/SessionWorkspace/parts/TimelinePane/useTimelineRows';
import { LOG_PAGE_ROWS, logPageOf } from './logPageOf';

const LOG_ROW_SELECTOR = '[data-log-row]';

const LOG_ROW_BOX = '[content-visibility:auto] data-row-near:[content-visibility:visible]';

type Props = {
  readonly session: Session;
  readonly query: string;
  readonly onClearSearch: () => void;
};

export const LogRows = ({ session, query, onClearSearch }: Props) => {
  const sessionId = session.id;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(LOG_PAGE_ROWS);
  const [isShowingMore, startShowingMore] = useTransition();
  useLayoutEffect(() => {
    viewportRef.current =
      rootRef.current === null ? null : scrollParentOf({ element: rootRef.current });
  }, []);
  useRowPreload({ viewportRef, rowSelector: LOG_ROW_SELECTOR });
  const anchor = useScrollAnchor({ listRef });
  const groups = useExplodeGroups();
  const { set: setGroup, showAll: showAllGroup } = groups;
  const setAnchored = useCallback<ExplodeGroups['set']>(
    ({ id, isExpanded }) => {
      anchor({ rowId: countRowIdOf({ expandId: id }) });
      setGroup({ id, isExpanded });
    },
    [anchor, setGroup],
  );
  const showAllAnchored = useCallback<ExplodeGroups['showAll']>(
    ({ id }) => {
      anchor({ rowId: id });
      showAllGroup({ id });
    },
    [anchor, showAllGroup],
  );
  const explode = useMemo(
    (): ExplodeGroups => ({ ...groups, set: setAnchored, showAll: showAllAnchored }),
    [groups, setAnchored, showAllAnchored],
  );
  const rows = useTimelineRows({ session, view: 'all', query, explode });
  const { rowPropsFor } = useTimelineRowProps({ session, explode, rows });
  const { entries, viewEntries } = rows;
  const shownRowIds = useRef<ReadonlySet<string>>(new Set());
  const wasShown = shownRowIds.current;
  const page = logPageOf({ count: rows.laidOutItems.length, limit });
  const shownItems = useMemo(
    () => rows.laidOutItems.slice(0, page.shownCount),
    [page.shownCount, rows.laidOutItems],
  );

  useLayoutEffect(() => {
    shownRowIds.current = new Set(rows.laidOutItems.map((item) => item.id));
  }, [rows.laidOutItems]);

  const isLoading = !rows.isLoaded && entries.length === 0;
  const isSearching = query.trim() !== '';

  if (isLoading) {
    return (
      <div ref={rootRef} className="flex flex-col">
        <TimelineSkeleton />
      </div>
    );
  }
  if (viewEntries.length === 0) {
    return (
      <div ref={rootRef} className="flex flex-col">
        <TimelineEmpty view="log" isSearching={isSearching} onClearSearch={onClearSearch} />
      </div>
    );
  }
  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
        <div ref={listRef} className="@container flex flex-col [overflow-anchor:none]">
          {shownItems.map((item, index) => {
            const props = rowPropsFor({ item, index });
            if (props === null) {
              return null;
            }
            const slot = item.kind === 'row' || item.kind === 'more' ? item.explode : undefined;
            const row = <TimelineRow {...props} />;
            return (
              <div
                key={item.id}
                data-log-row=""
                className={LOG_ROW_BOX}
                style={{ containIntrinsicSize: `auto ${item.height}px` }}
              >
                {slot === undefined ? (
                  row
                ) : (
                  <TimelineRevealRow
                    groupId={slot.groupId}
                    isLeaving={explode.leavingIds.has(slot.groupId)}
                    isShown={wasShown.has(item.id)}
                    onSettled={explode.settle}
                  >
                    {row}
                  </TimelineRevealRow>
                )}
              </div>
            );
          })}
        </div>
      </WorkTimeProvider>
      {page.nextCount > 0 ? (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          disabled={isShowingMore}
          aria-busy={isShowingMore}
          onClick={() => startShowingMore(() => setLimit(page.shownCount + LOG_PAGE_ROWS))}
        >
          {`${isShowingMore ? 'Showing' : 'Show'} ${countNoun({ count: page.nextCount, one: 'older row' })}`}
        </Button>
      ) : null}
    </div>
  );
};
