import { createContext } from 'react';
import type {
  TimelineAgentEntry,
  TimelineTopLevelEntry,
} from '../../../../timeline/buildTimelineGroups';

export type TimelineRoute = {
  readonly agentId: string;
  readonly groupId: string;
  readonly model: string | null;
};

export type TimelineRoutingFacts = {
  readonly modelShownAgentIds: ReadonlySet<string>;
};

export const TimelineRouting = createContext<TimelineRoutingFacts | null>(null);

const SESSION_GROUP_ID = 'session';

const collectAgentRoutes = ({
  entry,
  groupId,
  into,
}: {
  readonly entry: TimelineAgentEntry;
  readonly groupId: string;
  readonly into: Array<{ readonly agent: TimelineAgentEntry; readonly groupId: string }>;
}): void => {
  into.push({ agent: entry, groupId });
  for (const child of entry.children) {
    collectAgentRoutes({ entry: child, groupId: entry.id, into });
  }
};

export const agentGroupsOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
}): ReadonlyArray<{ readonly agent: TimelineAgentEntry; readonly groupId: string }> => {
  const found: Array<{ readonly agent: TimelineAgentEntry; readonly groupId: string }> = [];
  for (const entry of entries) {
    if (entry.kind === 'agent') {
      collectAgentRoutes({ entry, groupId: SESSION_GROUP_ID, into: found });
      continue;
    }
    if (entry.kind === 'run') {
      for (const child of entry.children) {
        if (child.kind === 'agent') {
          collectAgentRoutes({ entry: child, groupId: entry.id, into: found });
        }
      }
    }
  }
  return found;
};

export const routingFactsOf = ({
  routes,
}: {
  readonly routes: ReadonlyArray<TimelineRoute>;
}): TimelineRoutingFacts => {
  const modelCounts = new Map<string, Map<string, number>>();
  for (const route of routes) {
    if (route.model == null) {
      continue;
    }
    const counts = modelCounts.get(route.groupId) ?? new Map<string, number>();
    counts.set(route.model, (counts.get(route.model) ?? 0) + 1);
    modelCounts.set(route.groupId, counts);
  }
  const dominantByGroupId = new Map<string, string>();
  for (const [groupId, counts] of modelCounts) {
    const ranked = [...counts].sort((first, second) => second[1] - first[1]);
    const [top, runnerUp] = ranked;
    const total = ranked.reduce((sum, [, count]) => sum + count, 0);
    if (top !== undefined && total >= 2 && (runnerUp === undefined || top[1] > runnerUp[1])) {
      dominantByGroupId.set(groupId, top[0]);
    }
  }
  const modelShownAgentIds = new Set<string>();
  for (const route of routes) {
    if (route.model != null && route.model !== dominantByGroupId.get(route.groupId)) {
      modelShownAgentIds.add(route.agentId);
    }
  }
  return { modelShownAgentIds };
};

export const sameRoutingFacts = ({
  first,
  second,
}: {
  readonly first: TimelineRoutingFacts;
  readonly second: TimelineRoutingFacts;
}): boolean =>
  first.modelShownAgentIds.size === second.modelShownAgentIds.size &&
  [...first.modelShownAgentIds].every((id) => second.modelShownAgentIds.has(id));

export const isModelNameShown = ({
  facts,
  agentId,
}: {
  readonly facts: TimelineRoutingFacts | null;
  readonly agentId: string | undefined;
}): boolean => facts === null || agentId === undefined || facts.modelShownAgentIds.has(agentId);
