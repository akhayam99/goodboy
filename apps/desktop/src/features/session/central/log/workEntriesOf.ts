import type { WorkEvent } from '@goodboy/db';
import type { SessionProjectMount } from '@goodboy/types';
import type { TimelineWorkEntry } from '../../timeline/timelineFactEntries';

type Params = {
  readonly events: ReadonlyArray<WorkEvent>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

export const workEntriesOf = ({ events, mounts }: Params): ReadonlyArray<TimelineWorkEntry> =>
  events.map((work) => ({
    kind: 'work',
    id: `work:${work.id}`,
    at: new Date(work.startedAt).toISOString(),
    work,
    mountName: mounts.find((mount) => mount.mountId === work.mountId)?.mountName ?? null,
  }));
