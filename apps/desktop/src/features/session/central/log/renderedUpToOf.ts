import type { IsoDateTime } from '@goodboy/types';
import type { TimelineAgentEntry, TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

type AgentsParams = {
  readonly agents: ReadonlyArray<TimelineAgentEntry>;
};

const newestOf = ({ agents }: AgentsParams): IsoDateTime | null => {
  let newest: IsoDateTime | null = null;
  for (const entry of agents) {
    const finishedAt = entry.agent.lastFinishedAt;
    if (finishedAt != null && (newest === null || finishedAt > newest)) {
      newest = finishedAt;
    }
    const inner = newestOf({ agents: entry.children });
    if (inner !== null && (newest === null || inner > newest)) {
      newest = inner;
    }
  }
  return newest;
};

export const renderedUpToOf = ({ entries }: Params): IsoDateTime | null =>
  newestOf({
    agents: entries.filter((entry): entry is TimelineAgentEntry => entry.kind === 'agent'),
  });
