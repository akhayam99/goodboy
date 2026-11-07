import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';

type Params = {
  readonly entry: TimelineRunEntry;
};

export const runAgentEntriesOf = ({ entry }: Params): ReadonlyArray<TimelineAgentEntry> =>
  entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
