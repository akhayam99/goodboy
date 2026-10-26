import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';
import { useTimelineOpen } from '../../../hooks/useTimelineOpen';
import type { TimelineTopLevelEntry } from '../../../timeline/buildTimelineGroups';
import type { OverviewCardModel } from '../../overviewCardsOf';
import type { DoneSummary } from '../doneSummaryOf';
import type { LatestDone } from '../latestDoneOf';
import { LatestDoneRow } from '../LatestDoneRow';
import { OverviewCard } from '../OverviewCard';

type Props = {
  readonly sessionId: SessionId;
  readonly card: OverviewCardModel;
  readonly summary: DoneSummary;
  readonly latest: LatestDone;
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

const MINUTE_MS = 60_000;

const MARK_SEEN_KEY = 'mark-all-seen';

type LogParams = {
  readonly focusEntryId: string | null;
};

export const DoneCard = ({ sessionId, card, summary, latest, entries }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const markAllAgentsSeen = useAppStore((state) => state.markAllAgentsSeen);
  const openFor = useTimelineOpen({ sessionId });
  const nowMs = useNow(MINUTE_MS);
  const pending = usePendingAction({ sessionId });
  const openLog = ({ focusEntryId }: LogParams) =>
    openDrawer({ kind: 'session-log', sessionId, payload: { focusEntryId } });
  return (
    <OverviewCard
      card={card}
      countNote={latest.unreadCount === 0 ? null : `${latest.unreadCount} unread`}
      aside={
        <span className="flex items-center gap-1">
          {latest.unreadCount === 0 ? null : (
            <Button
              size="sm"
              variant="secondary"
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
          )}
          <Button size="sm" variant="secondary" onClick={() => openLog({ focusEntryId: null })}>
            Full log
          </Button>
        </span>
      }
    >
      <p data-done-line="" className="min-w-0 text-ui text-muted-foreground">
        {summary.line}
      </p>
      {latest.items.length === 0 ? null : (
        <ul aria-label="Latest finished" className="flex min-w-0 list-none flex-col gap-1">
          {latest.items.map((item) => {
            const entry = entries.find((candidate) => candidate.id === item.row.entryId);
            const target = entry === undefined ? null : openFor({ entry });
            return (
              <LatestDoneRow
                key={item.row.id}
                item={item}
                nowMs={nowMs}
                openLabel={
                  target === null
                    ? `Show ${item.row.title} in the log`
                    : `${target.label}: ${item.row.title}`
                }
                onOpen={() =>
                  target === null ? openLog({ focusEntryId: item.row.entryId }) : target.open()
                }
              />
            );
          })}
        </ul>
      )}
    </OverviewCard>
  );
};
