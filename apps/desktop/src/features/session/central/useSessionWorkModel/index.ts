import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOpenStopMountIds } from '../../hooks/useOpenStopMountIds';
import type { SessionWorktree } from '@goodboy/db';
import type { Agent, Session, SessionEvent, SessionId, TurnState } from '@goodboy/types';
import type { AgentKind } from '../../agent-kind';
import { useSessionWorkLoads } from '../../hooks/useSessionWorkLoads';
import {
  EMPTY_ARRAY,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionAnsweredQuestions,
  useSessionDismissedQuestions,
  useSessionOpenQuestions,
} from '../../../../store';
import { unreadAgentsOf } from '../../../../store/slices/agents/unreadAgentsOf';
import { autoRowFacts, type AutoRowFacts } from '../../../auto/autoRowFacts';
import { useAutoTrees } from '../../../auto/useAutoTrees';
import { withoutAutoChildren } from '../../../auto/withoutAutoChildren';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { JobActivityFacts } from '../../../../store/slices/history/jobFactsByAgentId';
import type { AttachedRun } from '../../../workflows/activeWorkflowRuns';
import type { WorkflowAdvanceState } from '../../../workflows/advanceGate';
import { useRebaseStatuses } from '../../../history/useRebaseStatuses';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { useWorkflowAdvanceStates } from '../../../workflows/useWorkflowAdvanceStates';
import { useJobActivity } from '../../hooks/useJobActivity';
import { useLiveAgentTurns } from '../../../../shared/hooks/useLiveAgentTurns';
import { useResolveActivity } from '../../hooks/useResolveActivity';
import {
  buildTimelineGroups,
  type TimelineTopLevelEntry,
} from '../../timeline/buildTimelineGroups';
import { buildTimelineStream } from '../../timeline/buildTimelineStream';
import { dayLabel } from '../../timeline/dayLabel';
import { needsYouOwners, type NeedsYouOwner } from '../../timeline/needsYou';
import type { ResolveActivityFacts } from '../../timeline/resolveActivity';

type Params = {
  readonly session: Session;
};

export type SessionWorkModel = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly agents: ReadonlyArray<Agent>;
  readonly worktrees: ReadonlyArray<SessionWorktree>;
  readonly settledStopIds: ReadonlySet<string>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly autoTrees: ReadonlyArray<AutoTreeView>;
  readonly workflows: ReadonlyArray<AttachedRun>;
  readonly advanceByRunId: ReadonlyMap<string, WorkflowAdvanceState>;
  readonly decidingRunIds: ReadonlySet<string>;
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly liveAgentIds: ReadonlySet<string> | undefined;
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly resolveFactsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
  readonly jobFactsByAgentId: ReadonlyMap<string, JobActivityFacts>;
  readonly autoFactsByAgentId: ReadonlyMap<string, AutoRowFacts>;
  readonly turnByAgentId: ReadonlyMap<string, TurnState>;
  readonly isLoaded: boolean;
};

export const useSessionWorkModel = ({ session }: Params): SessionWorkModel => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const artifacts = useAppStore((s) => s.sessionArtifacts?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const learnings = useAppStore((s) => s.sessionContextItems[sessionId] ?? EMPTY_ARRAY);
  const hasLoadedEvents = useAppStore((s) => s.sessionEvents?.[sessionId] !== undefined);
  const hasLoadedAgents = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const agentKindOverride = useAppStore(
    useShallow((s) => {
      const picked: Record<string, AgentKind> = {};
      for (const agent of agents) {
        const kind = s.agentKindOverride[agent.id];
        if (kind !== undefined) {
          picked[agent.id] = kind;
        }
      }
      return picked;
    }),
  );
  const openQuestions = useSessionOpenQuestions(sessionId);
  const answeredQuestions = useSessionAnsweredQuestions(sessionId);
  const dismissedQuestions = useSessionDismissedQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });
  const orchestratingRunIds = useAppStore(
    useShallow((s) =>
      workflows
        .filter(({ run }) => s.orchestratingWorkflowRuns?.[run.id] === true)
        .map(({ run }) => run.id),
    ),
  );
  const resolveActivity = useResolveActivity({ sessionId });
  const jobActivity = useJobActivity({ sessionId });
  const autoTrees = useAutoTrees({ sessionId });
  const settledStops = useAppStore((s) => s.settledRebaseStops[sessionId] ?? EMPTY_ARRAY);
  useRebaseStatuses({ sessionId });
  useSessionWorkLoads({ sessionId });

  const questions = useMemo(
    () => [...openQuestions, ...answeredQuestions, ...dismissedQuestions],
    [answeredQuestions, dismissedQuestions, openQuestions],
  );

  const autoFactsByAgentId = useMemo(() => {
    const facts = new Map<string, AutoRowFacts>();
    for (const view of autoTrees) {
      const rowFacts = autoRowFacts({ view });
      if (rowFacts !== null) {
        facts.set(view.tree.rootAgentId, rowFacts);
      }
    }
    return facts;
  }, [autoTrees]);

  const topLevelAgents = useMemo(
    () => withoutAutoChildren({ agents, views: autoTrees }),
    [agents, autoTrees],
  );

  const model = useMemo(
    () =>
      buildTimelineGroups({
        sessionId,
        agents: topLevelAgents,
        workflows,
        plans,
        artifacts,
        externalTasks,
        questions,
        worktrees,
        events,
        learnings,
        agentKindOverride,
      }),
    [
      agentKindOverride,
      topLevelAgents,
      artifacts,
      events,
      externalTasks,
      learnings,
      plans,
      questions,
      sessionId,
      workflows,
      worktrees,
    ],
  );

  const advanceByRunId = useWorkflowAdvanceStates({ sessionId, workflows, agents });
  const turnByAgentId = useLiveAgentTurns({ agents });

  const unreadAgentIds = useMemo(
    () => new Set<string>(unreadAgentsOf({ agents }).map((agent) => agent.id)),
    [agents],
  );

  const liveAgentIds = useMemo(
    () => (hasLoadedAgents ? new Set(agents.map((agent) => agent.id)) : undefined),
    [agents, hasLoadedAgents],
  );

  const settledStopIds = useMemo(() => new Set(settledStops), [settledStops]);
  const openMountIds = useOpenStopMountIds({ sessionId });

  const decidingRunIds = useMemo(() => new Set<string>(orchestratingRunIds), [orchestratingRunIds]);

  const owners = useMemo(
    () =>
      needsYouOwners({
        items: buildTimelineStream({
          entries: model.entries,
          unreadAgentIds,
          advanceByRunId,
          decidingRunIds,
          dayLabelFor: dayLabel,
          showQuestions: false,
          resolveFactsByAgentId: resolveActivity.factsByAgentId,
          jobFactsByAgentId: jobActivity.factsByAgentId,
          autoFactsByAgentId,
          turnByAgentId,
        }).items,
        entries: model.entries,
        events,
        resolveFactsByAgentId: resolveActivity.factsByAgentId,
        liveAgentIds,
        settledStopIds,
        openMountIds,
      }),
    [
      advanceByRunId,
      autoFactsByAgentId,
      decidingRunIds,
      events,
      jobActivity,
      liveAgentIds,
      model.entries,
      openMountIds,
      resolveActivity,
      settledStopIds,
      turnByAgentId,
      unreadAgentIds,
    ],
  );

  return {
    entries: model.entries,
    agents,
    worktrees,
    settledStopIds,
    events,
    autoTrees,
    workflows,
    advanceByRunId,
    decidingRunIds,
    unreadAgentIds,
    liveAgentIds,
    owners,
    resolveFactsByAgentId: resolveActivity.factsByAgentId,
    jobFactsByAgentId: jobActivity.factsByAgentId,
    autoFactsByAgentId,
    turnByAgentId,
    isLoaded: hasLoadedEvents && hasLoadedAgents,
  };
};
