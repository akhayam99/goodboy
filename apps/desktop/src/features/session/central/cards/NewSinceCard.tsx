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

type Props = {
  readonly sessionId: SessionId;
  readonly latest: LatestDone;
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

const MINUTE_MS = 60_000;

const MARK_SEEN_KEY = 'mark-all-seen';

export const NewSinceCard = ({ sessionId, latest, entries }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const markAllAgentsSeen = useAppStore((state) => state.markAllAgentsSeen);
  const markAgentSeen = useAppStore((state) => state.markAgentSeen);
  const openFor = useTimelineOpen({ sessionId });
  const nowMs = useNow(MINUTE_MS);
  const pending = usePendingAction({ sessionId });
  const leadAgentOf = useLeadAgentOf({ sessionId });
  if (latest.unreadItems.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="New since you last looked"
      data-overview-card="new-since"
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <SectionLabel
          label="New since you last looked"
          count={<span data-new-since-count="">{latest.unreadCount}</span>}
        />
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
          Mark all seen
        </Button>
      </header>
      <ul aria-label="New items" className="flex min-w-0 list-none flex-col gap-1">
        {latest.unreadItems.map((item) => {
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
