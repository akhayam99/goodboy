import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, ICON_SIZE, Input } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useRowPreload } from '../../../../shared/hooks/useRowPreload';
import { scrollParentOf } from '../../../../shared/utils/scrollParentOf';

import { countRowIdOf } from '../../timeline/buildTimelineStream';
import { useExplodeGroups, type ExplodeGroups } from '../../hooks/useExplodeGroups';
import { useScrollAnchor } from '../../hooks/useScrollAnchor';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { TimelineEmpty } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineEmpty';
import { TimelineRevealRow } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineRevealRow';
import { TimelineRow } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineRow';
import { TimelineSkeleton } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineSkeleton';
import { ActionColumnContext } from '../../components/SessionWorkspace/parts/TimelinePane/ActionColumnContext';
import { useTimelineRowProps } from '../../components/SessionWorkspace/parts/TimelinePane/useTimelineRowProps';
import { useTimelineRows } from '../../components/SessionWorkspace/parts/TimelinePane/useTimelineRows';
import { NAMES } from '../../../../shared/utils/names';

const MARK_SEEN_KEY = 'mark-all-seen';

const LOG_ROW_SELECTOR = '[data-log-row]';

const LOG_ROW_BOX = '[content-visibility:auto] data-row-near:[content-visibility:visible]';

type Props = {
  readonly session: Session;
  readonly hasRowActions?: boolean;
};

export const LogPane = ({ session, hasRowActions = true }: Props) => {
  const sessionId = session.id;
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const pending = usePendingAction({ sessionId });
  const [query, setQuery] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    viewportRef.current =
      sectionRef.current === null ? null : scrollParentOf({ element: sectionRef.current });
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
  const { rowPropsFor, hasActionColumn } = useTimelineRowProps({ session, explode, rows });
  const { entries, viewEntries } = rows;
  const shownRowIds = useRef<ReadonlySet<string>>(new Set());
  const wasShown = shownRowIds.current;

  useLayoutEffect(() => {
    shownRowIds.current = new Set(rows.laidOutItems.map((item) => item.id));
  }, [rows.laidOutItems]);

  const isLoading = !rows.isLoaded && entries.length === 0;
  const isSearching = query.trim() !== '';

  return (
    <ActionColumnContext.Provider value={hasRowActions && hasActionColumn}>
      <section
        ref={sectionRef}
        aria-label="Log entries"
        className="@container/activity flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <Input
            type="search"
            aria-label="Search the log"
            placeholder="Search the log"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {rows.unreadAgentIds.size > 0 ? (
            <Button
              variant="quiet"
              size="sm"
              disabled={pending.pendingKeys.has(MARK_SEEN_KEY)}
              onClick={() =>
                void pending.run({
                  key: MARK_SEEN_KEY,
                  failureTitle: "Couldn't mark the agents as seen",
                  task: () => markAllAgentsSeen(sessionId),
                })
              }
            >
              <CheckCheck size={ICON_SIZE.row} aria-hidden />
              {NAMES.markAsRead}
            </Button>
          ) : null}
        </div>
        {isLoading ? (
          <TimelineSkeleton />
        ) : viewEntries.length === 0 ? (
          <TimelineEmpty view="log" isSearching={isSearching} onClearSearch={() => setQuery('')} />
        ) : (
          <div className="flex flex-col gap-1">
            <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
              <div ref={listRef} className="@container flex flex-col [overflow-anchor:none]">
                {rows.laidOutItems.map((item, index) => {
                  const props = rowPropsFor({ item, index });
                  if (props === null) {
                    return null;
                  }
                  const slot =
                    item.kind === 'row' || item.kind === 'more' ? item.explode : undefined;
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
          </div>
        )}
      </section>
    </ActionColumnContext.Provider>
  );
};
