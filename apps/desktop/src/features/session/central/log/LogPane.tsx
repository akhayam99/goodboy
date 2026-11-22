import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { CheckCheck } from '@goodboy/ui/icons';
import {
  Button,
  ErrorStrip,
  ICON_SIZE,
  Listbox,
  SearchField,
  type ListboxOption,
} from '@goodboy/ui';
import type { MountId, Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { agentHasUnread } from '../../../../store/slices/agents/agentHasUnread';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { TimelineSkeleton } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineSkeleton';
import { NAMES } from '../../../../shared/utils/names';
import type { TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';
import type { ActivityKind } from './activityKindOf';
import { activityEntriesOf } from './activityEntriesOf';
import { ActivityProjectFilter } from './ActivityProjectFilter';
import { LogRows } from './LogRows';
import { useWorkEvents } from '../../hooks/useWorkEvents';
import { workEntriesOf } from './workEntriesOf';

const MARK_SEEN_KEY = 'mark-all-seen';
const SEARCH_ENTRIES = NAMES.searchEntries;
const MIN_PROJECTS_FOR_FILTER = 2;
const ALL = 'all';
const WORK_LABELS: ReadonlyArray<string> = ['scripts and commands'];

type KindValue = ActivityKind | typeof ALL;

const KIND_OPTIONS: ReadonlyArray<ListboxOption<KindValue>> = [
  { value: ALL, label: NAMES.allActivity },
  { value: 'agents', label: NAMES.agents },
  { value: 'branch', label: NAMES.branches },
  { value: 'check', label: NAMES.checks },
  { value: 'script', label: NAMES.scripts },
  { value: 'context', label: NAMES.context },
];

const NO_MOUNT_IDS: ReadonlySet<MountId> = new Set();

const NO_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type Props = {
  readonly session: Session;
};

type NarrowParams = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

type MountIdsParams = {
  readonly mountIds: ReadonlySet<MountId>;
};

export const LogPane = ({ session }: Props) => {
  const sessionId = session.id;
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const hasUnread = useAppStore((s) =>
    (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).some((agent) => agentHasUnread(agent, false)),
  );
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? NO_MOUNTS);
  const pending = usePendingAction({ sessionId });
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindValue>(ALL);
  const [mountIds, setMountIds] = useState<ReadonlySet<MountId>>(NO_MOUNT_IDS);
  const drawnSessionId = useDeferredValue<SessionId | null>(sessionId, null);
  const work = useWorkEvents({ sessionId });
  const workEntries = useMemo(
    () => workEntriesOf({ events: work.events, mounts }),
    [mounts, work.events],
  );
  const knownMountIds = useMemo(
    () => new Set([...mountIds].filter((id) => mounts.some((mount) => mount.mountId === id))),
    [mountIds, mounts],
  );
  const filter = useMemo(
    () => ({ kind: kind === ALL ? null : kind, mountIds: knownMountIds }),
    [kind, knownMountIds],
  );
  const isFiltered = filter.kind !== null || filter.mountIds.size > 0;
  const narrow = useCallback(
    ({ entries }: NarrowParams) => activityEntriesOf({ entries, filter, mounts }),
    [filter, mounts],
  );
  const clearFilters = useCallback(() => {
    setKind(ALL);
    setMountIds(NO_MOUNT_IDS);
  }, []);

  return (
    <section aria-label="Log entries" className="@container/activity flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          ariaLabel={SEARCH_ENTRIES}
          placeholder={SEARCH_ENTRIES}
          value={query}
          onChange={setQuery}
          className="min-w-48 flex-1"
        />
        <Listbox
          trigger="chip"
          size="sm"
          ariaLabel={NAMES.activityKindFilter}
          options={KIND_OPTIONS}
          value={kind}
          onChange={setKind}
        />
        {mounts.length >= MIN_PROJECTS_FOR_FILTER ? (
          <ActivityProjectFilter
            mounts={mounts}
            selected={knownMountIds}
            onChange={({ mountIds: next }: MountIdsParams) => setMountIds(next)}
          />
        ) : null}
        {hasUnread ? (
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
      <ErrorStrip labels={WORK_LABELS} error={work.error} onRetry={work.retry} />
      {drawnSessionId === sessionId ? (
        <LogRows
          key={sessionId}
          session={session}
          query={query}
          onClearSearch={() => setQuery('')}
          extraEntries={workEntries}
          narrow={narrow}
          hasOlder={work.hasOlder}
          onReachEnd={work.loadOlder}
          isFiltered={isFiltered}
          onClearFilters={clearFilters}
        />
      ) : (
        <TimelineSkeleton />
      )}
    </section>
  );
};
