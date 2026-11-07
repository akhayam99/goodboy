import { useState } from 'react';
import { Button, SectionLabel } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useTimelineOpen } from '../../hooks/useTimelineOpen';
import type { TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';
import type { LatestDone } from './latestDoneOf';
import { LatestDoneRow } from './LatestDoneRow';
import { useLeadAgentOf } from '../../hooks/useLeadAgentOf';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly sessionId: SessionId;
  readonly latest: LatestDone;
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

const MINUTE_MS = 60_000;

const MARK_SEEN_KEY = 'mark-all-seen';

const MAX_VISIBLE_ROWS = 3;

export const NewSinceCard = ({ sessionId, latest, entries }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const markAllAgentsSeen = useAppStore((state) => state.markAllAgentsSeen);
  const markAgentSeen = useAppStore((state) => state.markAgentSeen);
  const openFor = useTimelineOpen({ sessionId });
  const nowMs = useNow(MINUTE_MS);
  const pending = usePendingAction({ sessionId });
  const leadAgentOf = useLeadAgentOf({ sessionId });
  const [isOpen, setIsOpen] = useState(false);
  const newest = latest.unreadItems[0];
  if (newest === undefined) {
    return null;
  }
  const markAllSeen = (
    <Button
      size="sm"
      variant="quiet"
      disabled={pending.pendingKeys.has(MARK_SEEN_KEY)}
      onClick={() =>
        void pending.run({
          key: MARK_SEEN_KEY,
          failureTitle: "Couldn't mark the agents as seen",
          task: () => markAllAgentsSeen(sessionId),
        })
      }
    >
      {NAMES.markAsRead}
    </Button>
  );
  if (!isOpen) {
    return (
      <section
        aria-label="New since you last looked"
        data-overview-card="new-since"
        className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg bg-subtle px-4"
      >
        <p data-new-since-summary="" className="min-w-0 truncate text-ui text-muted-foreground">
          <span data-new-since-count="">{latest.unreadCount}</span> new since you looked, latest:{' '}
          {newest.row.title}
        </p>
        <span className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="quiet" onClick={() => setIsOpen(true)}>
            Show
          </Button>
          {markAllSeen}
        </span>
      </section>
    );
  }
  return (
    <section
      aria-label="New since you last looked"
      data-overview-card="new-since"
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <SectionLabel
          headingLevel={2}
          label="New since you last looked"
          count={<span data-new-since-count="">{latest.unreadCount}</span>}
        />
        <span className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="quiet" onClick={() => setIsOpen(false)}>
            Hide
          </Button>
          {markAllSeen}
        </span>
      </header>
      <ul aria-label="New items" className="flex min-w-0 list-none flex-col gap-1">
        {latest.unreadItems.slice(0, MAX_VISIBLE_ROWS).map((item) => {
          const entry = entries.find((candidate) => candidate.id === item.row.entryId);
          const target = entry === undefined ? null : openFor({ entry });
          return (
            <LatestDoneRow
              key={item.row.id}
              item={item}
              nowMs={nowMs}
              leadAgent={leadAgentOf({ agentId: item.row.leadAgentId })}
              openLabel={
                target === null
                  ? `Show ${item.row.title} in the log`
                  : `${target.label}: ${item.row.title}`
              }
              onOpen={() => {
                if (target !== null) {
                  target.open();
                  return;
                }
                for (const agentId of item.row.agentIds) {
                  void markAgentSeen(sessionId, agentId);
                }
                openDrawer({
                  kind: 'session-log',
                  sessionId,
                  payload: { focusEntryId: item.row.entryId },
                });
              }}
            />
          );
        })}
      </ul>
    </section>
  );
};
