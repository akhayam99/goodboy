import type { SessionEvent } from '@goodboy/types';
import { hasHistoryRecovery } from '../../history/historyRecovery';
import type { TimelineEventEntry, TimelineTopLevelEntry } from './buildTimelineGroups';

export type ActivityView = 'activity' | 'log';

export const ACTIVITY_VIEW_LABEL: Readonly<Record<ActivityView, string>> = {
  activity: 'Activity',
  log: 'Log',
};

type Params = {
  readonly entry: TimelineTopLevelEntry;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly liveAgentIds?: ReadonlySet<string>;
  readonly settledStopIds?: ReadonlySet<string>;
};

const hasRecovery = ({
  entry,
  events,
  liveAgentIds,
  settledStopIds,
}: {
  readonly entry: TimelineEventEntry;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly liveAgentIds: ReadonlySet<string> | undefined;
  readonly settledStopIds: ReadonlySet<string> | undefined;
}): boolean => {
  const { event } = entry;
  if (event.kind === 'branch_deleted') {
    return event.payload?.deletedBranchId !== undefined;
  }
  return hasHistoryRecovery({ event, events, liveAgentIds, settledStopIds });
};

const eventViewOf = ({
  entry,
  events,
  liveAgentIds,
  settledStopIds,
}: {
  readonly entry: TimelineEventEntry;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly liveAgentIds: ReadonlySet<string> | undefined;
  readonly settledStopIds: ReadonlySet<string> | undefined;
}): ActivityView | null => {
  const { kind } = entry.event;
  if (kind === 'workflow_started') {
    return null;
  }
  if (kind === 'decisions_changed') {
    return entry.lane == null ? 'log' : 'activity';
  }
  if (kind === 'history_stopped') {
    return hasRecovery({ entry, events, liveAgentIds, settledStopIds }) ? null : 'log';
  }
  return hasRecovery({ entry, events, liveAgentIds, settledStopIds }) ? 'activity' : 'log';
};

const activityViewOf = ({
  entry,
  events,
  liveAgentIds,
  settledStopIds,
}: Params): ActivityView | null => {
  switch (entry.kind) {
    case 'run':
    case 'agent':
      return 'activity';
    case 'plan':
    case 'artifact':
    case 'learning':
      return entry.lane == null && entry.launchEntryId === undefined ? 'log' : 'activity';
    case 'question':
      if (entry.lane != null) {
        return 'activity';
      }
      return entry.questions.some((question) => question.status === 'open') ? null : 'log';
    case 'event':
      return eventViewOf({ entry, events, liveAgentIds, settledStopIds });
    case 'issue':
    case 'branch':
      return 'log';
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};

export type EntriesView = ActivityView | 'all';

export const entriesOfView = ({
  entries,
  events,
  view,
  liveAgentIds,
  settledStopIds,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly view: EntriesView;
  readonly liveAgentIds?: ReadonlySet<string>;
  readonly settledStopIds?: ReadonlySet<string>;
}): ReadonlyArray<TimelineTopLevelEntry> =>
  entries.filter((entry) => {
    const entryView = activityViewOf({ entry, events, liveAgentIds, settledStopIds });
    return view === 'all' ? entryView !== null : entryView === view;
  });
