import { useMemo } from 'react';
import type { Agent, AgentId, IsoDateTime, Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useSessionOpenQuestions,
} from '../../../../store';
import {
  buildTimelineGroups,
  type TimelineAgentEntry,
  type TimelineTopLevelEntry,
} from '../../../session/timeline/buildTimelineGroups';
import { buildAgentTreeStream } from '../../../session/timeline/buildTimelineStream';
import type { RunIdentity } from '../../../session/timeline/runIdentity';
import { layoutTimelineRail } from '../../../workTreeModel/railGeometry';
import { useAttachedWorkflowRuns } from '../../useAttachedWorkflowRuns';
import type { RunTreeModel } from './useRunTree';

const UNDATED_RUN_AT = new Date(0).toISOString() as IsoDateTime;

type Params = {
  readonly session: Session;
  readonly rootAgentId: AgentId;
  readonly childIds: ReadonlySet<AgentId>;
};

type Located = {
  readonly entry: TimelineAgentEntry;
  readonly identity: RunIdentity | null;
};

type LocateParams = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly agentId: AgentId;
};

const findEntry = ({
  entry,
  agentId,
}: {
  readonly entry: TimelineAgentEntry;
  readonly agentId: AgentId;
}): TimelineAgentEntry | null => {
  if (entry.agent.id === agentId) {
    return entry;
  }
  for (const child of entry.children) {
    const found = findEntry({ entry: child, agentId });
    if (found !== null) {
      return found;
    }
  }
  return null;
};

const locateAgentEntry = ({ entries, agentId }: LocateParams): Located | null => {
  for (const top of entries) {
    if (top.kind === 'run') {
      for (const child of top.children) {
        const found = child.kind === 'agent' ? findEntry({ entry: child, agentId }) : null;
        if (found !== null) {
          return { entry: found, identity: top.identity };
        }
      }
      continue;
    }
    if (top.kind === 'agent') {
      const found = findEntry({ entry: top, agentId });
      if (found !== null) {
        return { entry: found, identity: top.chain?.identity ?? null };
      }
    }
  }
  return null;
};

const withLabels = ({
  entry,
  label,
}: {
  readonly entry: TimelineAgentEntry;
  readonly label: string | null;
}): TimelineAgentEntry => {
  const byOrdinal = [...entry.children].sort((first, second) => first.ordinal - second.ordinal);
  const labelById = new Map(
    byOrdinal.map((child, index) => [
      child.id,
      label == null ? `${index + 1}` : `${label}.${index + 1}`,
    ]),
  );
  return {
    ...entry,
    stepLabel: label,
    children: entry.children.map((child) =>
      withLabels({ entry: child, label: labelById.get(child.id) ?? null }),
    ),
  };
};

export const useSubagentTree = ({
  session,
  rootAgentId,
  childIds,
}: Params): RunTreeModel | null => {
  const sessionId = session.id;
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });

  const located = useMemo(() => {
    const model = buildTimelineGroups({
      sessionId,
      agents,
      workflows: workflows.map((attached) =>
        attached.run.createdAt == null
          ? { ...attached, run: { ...attached.run, createdAt: UNDATED_RUN_AT } }
          : attached,
      ),
      plans: EMPTY_ARRAY,
      artifacts: EMPTY_ARRAY,
      externalTasks: EMPTY_ARRAY,
      questions: openQuestions,
      worktrees: EMPTY_ARRAY,
      events: EMPTY_ARRAY,
      agentKindOverride,
    });
    return locateAgentEntry({ entries: model.entries, agentId: rootAgentId });
  }, [agentKindOverride, agents, openQuestions, rootAgentId, sessionId, workflows]);

  const unreadAgentIds = useMemo(() => {
    const unread = new Set<string>();
    for (const agent of agents) {
      if (agentHasUnread(agent, false)) {
        unread.add(agent.id);
      }
    }
    return unread;
  }, [agents]);

  return useMemo(() => {
    if (located === null) {
      return null;
    }
    const children = located.entry.children.filter((child) => childIds.has(child.agent.id));
    if (children.length === 0) {
      return null;
    }
    const filtered = { ...located.entry, children };
    const entry =
      filtered.stepLabel == null ? withLabels({ entry: filtered, label: null }) : filtered;
    const stream = buildAgentTreeStream({ entry, identity: located.identity, unreadAgentIds });
    return {
      stream,
      rail: layoutTimelineRail({ rows: stream.items, groups: stream.groups, hasSpine: false }),
    };
  }, [childIds, located, unreadAgentIds]);
};
