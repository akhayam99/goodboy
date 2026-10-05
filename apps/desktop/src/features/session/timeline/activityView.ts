import type { SessionEvent } from '@goodboy/types';
import { hasHistoryRecovery } from '../../history/historyRecovery';
import type { TimelineEventEntry, TimelineTopLevelEntry } from './buildTimelineGroups';

export type ActivityView = 'activity' | 'log';

export const ACTIVITY_VIEWS: ReadonlyArray<ActivityView> = ['activity', 'log'];

export const ACTIVITY_VIEW_LABEL: Readonly<Record<ActivityView, string>> = {
  activity: 'Activity',
  log: 'Log',
};

type Params = {
  readonly entry: TimelineTopLevelEntry;
  readonly events: ReadonlyArray<SessionEvent>;
};

const hasRecovery = ({
  entry,
  events,
}: {
  readonly entry: TimelineEventEntry;
  readonly events: ReadonlyArray<SessionEvent>;
}): boolean => {
  const { event } = entry;
  if (event.kind === 'branch_deleted') {
    return event.payload?.deletedBranchId !== undefined;
  }
  return hasHistoryRecovery({ event, events });
};

const eventViewOf = ({
  entry,
  events,
}: {
  readonly entry: TimelineEventEntry;
  readonly events: ReadonlyArray<SessionEvent>;
}): ActivityView | null => {
  const { kind } = entry.event;
  if (kind === 'workflow_started') {
    return null;
  }
  if (kind === 'decisions_changed') {
    return entry.lane == null ? 'log' : 'activity';
  }
  if (kind === 'history_stopped') {
    return hasRecovery({ entry, events }) ? null : 'log';
  }
  return hasRecovery({ entry, events }) ? 'activity' : 'log';
};

const activityViewOf = ({ entry, events }: Params): ActivityView | null => {
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
      return eventViewOf({ entry, events });
    case 'issue':
    case 'branch':
      return 'log';
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};

export const entriesOfView = ({
  entries,
  events,
  view,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly view: ActivityView;
}): ReadonlyArray<TimelineTopLevelEntry> =>
  entries.filter((entry) => activityViewOf({ entry, events }) === view);
