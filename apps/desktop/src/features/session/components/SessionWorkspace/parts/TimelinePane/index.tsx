import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, IconButton, SectionHeader } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import {
  activityCategoryOf,
  activityCounts,
  hiddenRowCount,
} from '../../../../timeline/activityFilter';
import { firstNeedsYouRowId, hasWaitingRow } from '../../../../timeline/needsYou';
import { useActivityFilter } from '../../../../hooks/useActivityFilter';
import { useExplodeGroups, type ExplodeGroups } from '../../../../hooks/useExplodeGroups';
import { useScrollAnchor } from '../../../../hooks/useScrollAnchor';
import { WorkTimeProvider } from '../../../../../workTreeModel/components/WorkTimeProvider';
import { ActivityFilterPanel } from './ActivityFilterPanel';
import { NeedsYouChip } from './NeedsYouChip';
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

export const TimelinePane = ({ session, actions, onShownQuestionsChange }: Props) => {
  const sessionId: SessionId = session.id;
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const activity = useActivityFilter();
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
  const rows = useTimelineRows({ session, activity, explode });
  const rowPropsFor = useTimelineRowProps({ session, explode, rows });
  const { stream, entries, visibleEntries, shownQuestions } = rows;
  const { isNeedsYou } = activity;
  const shownQuestionsKey = [...shownQuestions].sort().join(' ');

  useLayoutEffect(() => {
    onShownQuestionsChange?.(shownQuestions);
  }, [onShownQuestionsChange, shownQuestionsKey]);

  const revealNeedsYou = () => {
    const rowId = firstNeedsYouRowId({ items: stream.items });
    const row =
      rowId === null
        ? undefined
        : Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? []).find(
            (element) => element.dataset.rowId === rowId,
          );
    if (row === undefined) {
      activity.applyPreset({ preset: 'needsYou' });
      return;
    }
    row.scrollIntoView({ block: 'center' });
    row.querySelector<HTMLElement>('[data-testid="timeline-row-action"] button')?.focus({
      preventScroll: true,
    });
  };

  const hasUnreadAgents = rows.unreadAgentIds.size > 0;
  const counts = activityCounts({ entries });
  const hiddenRows =
    hiddenRowCount({
      entries,
      filter: activity.filter,
      revealed: rows.revealedRows,
    }) + rows.hiddenChildRows;
  const rowKindCount = new Set(entries.map((entry) => activityCategoryOf({ entry }))).size;
  const hasFilter = rowKindCount >= 2 || activity.hidden.length > 0 || isNeedsYou;
  const isLoading = !rows.isLoaded && entries.length === 0;
  const emptyHint =
    rows.isLoaded && entries.length === 0
      ? 'Nothing yet. Agents, workflows and session facts land here as they happen.'
      : undefined;

  return (
    <section aria-label="Activity" className="@container/activity flex flex-col gap-2">
      <SectionHeader
        label="Activity"
        hint={emptyHint}
        meta={
          hasWaitingRow({ items: stream.items }) ? null : (
            <NeedsYouChip count={rows.needsYouTotal} onReveal={revealNeedsYou} />
          )
        }
        action={
          <div className="flex items-center gap-1">
            {hasUnreadAgents ? (
              <IconButton
                icon={CheckCheck}
                label="Mark all seen"
                variant="ghost"
                onClick={() => void markAllAgentsSeen(sessionId)}
              />
            ) : null}
            {hasFilter ? (
              <ActivityFilterPanel
                filter={activity.filter}
                hidden={activity.hidden}
                hiddenRows={hiddenRows}
                preset={activity.preset}
                counts={counts}
                visibleCount={visibleEntries.length}
                totalCount={entries.length}
                onToggle={activity.setToggle}
                onPreset={activity.applyPreset}
              />
            ) : null}
            {actions}
          </div>
        }
      />
      {isLoading ? (
        <TimelineSkeleton />
      ) : entries.length === 0 ? null : visibleEntries.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <p className="min-w-0 flex-1 text-label text-muted-foreground">
            {isNeedsYou
              ? 'Nothing needs you right now.'
              : 'Everything is hidden by the activity filter. Show a category to bring it back.'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activity.applyPreset({ preset: 'everything' })}
          >
            Show everything
          </Button>
        </div>
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
