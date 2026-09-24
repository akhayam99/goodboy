import { useMemo } from 'react';
import type { Agent, IsoDateTime, Session, Workflow, WorkflowRun } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useSessionOpenQuestions,
} from '../../../../store';
import type { AgentKind } from '../../../session/agent-kind';
import { buildTimelineGroups } from '../../../session/timeline/buildTimelineGroups';
import {
  buildRunTreeStream,
  type TimelineStream,
} from '../../../session/timeline/buildTimelineStream';
import { layoutTimelineRail, type RailLayout } from '../../../workTreeModel/railGeometry';
import { useAttachedWorkflowRuns } from '../../useAttachedWorkflowRuns';
import { useWorkflowRunAdvance } from '../../hooks/useWorkflowRunAdvance';

const UNDATED_RUN_AT = new Date(0).toISOString() as IsoDateTime;

type Params = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
};

export type RunTreeModel = {
  readonly stream: TimelineStream;
  readonly rail: RailLayout;
};

export const useRunTree = ({
  session,
  run,
  workflow,
  agentKindOverride,
}: Params): RunTreeModel | null => {
  const sessionId = session.id;
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isDeciding = useAppStore((state) => state.orchestratingWorkflowRuns?.[run.id] === true);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });
  const advance = useWorkflowRunAdvance({ sessionId, run, workflow });

  const entry = useMemo(() => {
    const model = buildTimelineGroups({
      sessionId,
      agents,
      workflows: workflows.map((attached) =>
        attached.run.id === run.id && attached.run.createdAt == null
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
    for (const candidate of model.entries) {
      if (candidate.kind === 'run' && candidate.run.id === run.id) {
        return candidate;
      }
    }
    return null;
  }, [agentKindOverride, agents, openQuestions, run.id, sessionId, workflows]);

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
    if (entry === null) {
      return null;
    }
    const stream = buildRunTreeStream({
      entry,
      unreadAgentIds,
      advance: advance.state,
      isDeciding,
    });
    return {
      stream,
      rail: layoutTimelineRail({ rows: stream.items, groups: stream.groups, hasSpine: false }),
    };
  }, [advance.state, entry, isDeciding, unreadAgentIds]);
};
