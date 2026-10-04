import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Input, SegmentedTabs } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import {
  ACTIVITY_VIEWS,
  ACTIVITY_VIEW_LABEL,
  type ActivityView,
} from '../../../../timeline/activityView';
import { useExplodeGroups, type ExplodeGroups } from '../../../../hooks/useExplodeGroups';
import { useScrollAnchor } from '../../../../hooks/useScrollAnchor';
import { WorkTimeProvider } from '../../../../../workTreeModel/components/WorkTimeProvider';
import { NeedsYouBlock } from './NeedsYouBlock';
import { TimelineRevealRow } from './TimelineRevealRow';
import { TimelineRow } from './TimelineRow';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useTimelineRowProps } from './useTimelineRowProps';
import { useTimelineRows } from './useTimelineRows';

type Props = {
  readonly session: Session;
  readonly actions: ReactNode;
  readonly onShownQuestionsChange?: (ids: ReadonlySet<string>) => void;
};

const VIEW_OPTIONS = ACTIVITY_VIEWS.map((view) => ({
  value: view,
  label: ACTIVITY_VIEW_LABEL[view],
}));

const EMPTY_COPY: Readonly<Record<ActivityView, string>> = {
  activity: 'Nothing yet',
  log: 'Nothing in the log yet',
};

export const TimelinePane = ({ session, actions, onShownQuestionsChange }: Props) => {
  const sessionId: SessionId = session.id;
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const [view, setView] = useState<ActivityView>('activity');
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const anchor = useScrollAnchor({ listRef });
  const groups = useExplodeGroups();
  const { set: setGroup, showAll: showAllGroup } = groups;
  const setAnchored = useCallback<ExplodeGroups['set']>(
    ({ id, isExpanded }) => {
      anchor({ rowId: id });
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
  const rows = useTimelineRows({ session, view, query, explode });
  const { rowPropsFor, openNeedsYou } = useTimelineRowProps({ session, explode, rows });
  const { stream, entries, viewEntries, shownQuestions, owners } = rows;
  const shownQuestionsKey = [...shownQuestions].sort().join(' ');
  const shownRowIds = useRef<ReadonlySet<string>>(new Set());
  const wasShown = shownRowIds.current;

  useLayoutEffect(() => {
    shownRowIds.current = new Set(rows.laidOutItems.map((item) => item.id));
  }, [rows.laidOutItems]);

  useLayoutEffect(() => {
    onShownQuestionsChange?.(shownQuestions);
  }, [onShownQuestionsChange, shownQuestionsKey]);

  const hasUnreadAgents = rows.unreadAgentIds.size > 0;
  const isLoading = !rows.isLoaded && entries.length === 0;
  const isSearching = view === 'log' && query.trim() !== '';
  const emptyCopy = isSearching ? 'Nothing in the log matches' : EMPTY_COPY[view];

  return (
    <section aria-label="Activity" className="@container/activity flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SegmentedTabs
            ariaLabel="Activity view"
            size="xs"
            options={VIEW_OPTIONS}
            value={view}
            onChange={setView}
          />
          {hasUnreadAgents ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6"
              onClick={() => void markAllAgentsSeen(sessionId)}
            >
              Mark all seen
            </Button>
          ) : null}
        </div>
        {actions}
      </div>
      {view === 'log' ? (
        <Input
          type="search"
          aria-label="Search the log"
          placeholder="Search the log"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : (
        <NeedsYouBlock owners={owners} onOpen={openNeedsYou} />
      )}
      {isLoading ? (
        <TimelineSkeleton />
      ) : viewEntries.length === 0 ? (
        <p className="px-3 py-2 text-label text-muted-foreground">{emptyCopy}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
            <div ref={listRef} className="@container flex flex-col [overflow-anchor:none]">
              {rows.laidOutItems.map((item, index) => {
                const props = rowPropsFor({ item, index });
                if (props === null) {
                  return null;
                }
                const slot = item.kind === 'row' || item.kind === 'more' ? item.explode : undefined;
                if (slot === undefined) {
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
  );
};
