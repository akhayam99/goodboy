import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, ICON_SIZE, Input, tintClasses } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';

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

const MARK_SEEN_KEY = 'mark-all-seen';

type Props = {
  readonly session: Session;
  readonly focusEntryId?: string | null;
};

export const LogPane = ({ session, focusEntryId = null }: Props) => {
  const sessionId = session.id;
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const pending = usePendingAction({ sessionId });
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
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
  const hasLaidOutRows = rows.laidOutItems.length > 0;

  useLayoutEffect(() => {
    if (focusEntryId === null || !hasLaidOutRows) {
      return;
    }
    const target = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [],
    ).find((element) => element.dataset.rowId === focusEntryId);
    target?.scrollIntoView({ block: 'center' });
  }, [focusEntryId, hasLaidOutRows]);

  return (
    <ActionColumnContext.Provider value={hasActionColumn}>
      <section aria-label="Log entries" className="@container/activity flex flex-col gap-2">
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
              variant="ghost"
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
              Mark all seen
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
                  if (slot === undefined) {
                    if (item.id === focusEntryId) {
                      return (
                        <div
                          key={item.id}
                          data-log-focus=""
                          className={tintClasses('primary').bgSoft}
                        >
                          <TimelineRow {...props} />
                        </div>
                      );
                    }
                    return <TimelineRow key={item.id} {...props} />;
                  }
                  return (
                    <TimelineRevealRow
                      key={item.id}
                      groupId={slot.groupId}
                      isLeaving={explode.leavingIds.has(slot.groupId)}
                      isShown={wasShown.has(item.id)}
                      onSettled={explode.settle}
                    >
                      <TimelineRow {...props} />
                    </TimelineRevealRow>
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
