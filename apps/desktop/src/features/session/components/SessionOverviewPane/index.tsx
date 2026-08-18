import { useEffect, useMemo, useState } from 'react';
import { Eyebrow, LensEmptyState } from '@goodboy/ui';
import { classifyWorkflowChain, runsForWorkflowRun, upcomingSteps } from '@goodboy/core';
import type { Agent, AgentId, Session, SessionId, Workflow } from '@goodboy/types';
import {
  agentHasUnread,
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionStageInfo,
  useSessionLoading,
  useSessionSlots,
  useSlotHistory,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { useWorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
import {
  agentHomeLens,
  classifyAgent,
  resolveRootAgent,
  selectStandaloneAgents,
  type AgentHomeLens,
} from '../../agent-kind';
import { useActiveResolverCount } from '../../hooks/useActiveResolverCount';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { selectOpenQuestions } from './lib';
import {
  selectNextUp,
  type NextUpItem,
  type RunningAgent,
  type StalledStep,
  type UpcomingStep,
  type WaitingAgent,
} from './selectNextUp';
import { HeaderBand } from './HeaderBand';
import { NextUpCard } from './NextUpCard';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { CreateAgentPopover } from '../CreateAgentPopover';
import { StartRowContent } from './StartRowContent';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { OverviewActions } from './OverviewActions';
import { InspectorSplit } from '../SessionWorkspace/parts/InspectorSplit';
import { SlotHistoryPanel } from '../SessionWorkspace/parts/SlotHistoryPanel';
import { GoalOverviewRegion } from './GoalOverviewRegion';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];

type AgentIdFromStringParams = {
  readonly value: string;
};

const agentIdFromString = ({ value }: AgentIdFromStringParams): AgentId =>
  JSON.parse(JSON.stringify(value));

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const slots = useSessionSlots(sessionId);
  const slotLoading = useSessionLoading(sessionId);
  const goalHistory = useSlotHistory(sessionId, 'goal');
  const goalHistoryCount = useSlotHistoryCount(sessionId, 'goal');
  const summarizer = useSummarizerStatus(sessionId);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const [isGoalHistoryOpen, setIsGoalHistoryOpen] = useState(false);
  const goalSlot = slots.find((slot) => slot.key === 'goal');
  const stage = useSessionStageInfo(session);
  const sessionList = useMemo(() => [session], [session]);
  const runs = useWorkspaceRuns(session.workspaceId, sessionList);
  const pullRequest = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const openQuestions = selectOpenQuestions(useSessionOpenQuestions(session.id));
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const rawStandalone = selectStandaloneAgents(sessionAgents);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const nonResolverAgents = useNonResolverStandaloneAgents(sessionId);
  const activeResolverCount = useActiveResolverCount(sessionId);
  const pendingResolutionCount = useAppStore(
    (s) => s.sessionPendingResolutions[sessionId]?.length ?? 0,
  );
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates?.[session.workspaceId] ?? EMPTY_WORKFLOWS,
  );
  const sessionWorkflows = useAppStore((s) => s.sessionWorkflows?.[sessionId] ?? EMPTY_WORKFLOWS);
  const workflowById = useMemo(() => {
    const map = new Map<string, Workflow>();
    for (const workflow of phaseTemplates) {
      map.set(workflow.id, workflow);
    }
    for (const workflow of sessionWorkflows) {
      map.set(workflow.id, workflow);
    }
    return map;
  }, [phaseTemplates, sessionWorkflows]);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const loadPendingResolutions = useAppStore((s) => s.loadPendingResolutions);

  useEffect(() => {
    void loadPendingResolutions(sessionId);
  }, [sessionId, loadPendingResolutions]);

  const activeRuns = useMemo(
    () => session.workflowRuns.filter((run) => run.discardedAt == null),
    [session.workflowRuns],
  );
  const isFresh = activeRuns.length === 0 && rawStandalone.length === 0;
  const resolveCount = activeResolverCount;
  const questionBlocksRun = openQuestions.some(
    (question) =>
      question.workflowRunId != null && activeRuns.some((run) => run.id === question.workflowRunId),
  );

  const pickAgentId = ({
    candidates,
  }: {
    readonly candidates: ReadonlyArray<Agent>;
  }): string | null => {
    const needsAttention =
      candidates.find((agent) => agentHasUnread(agent, false)) ??
      candidates.find((agent) => agent.status === 'failed') ??
      candidates.find((agent) => agent.status === 'running');
    return (needsAttention ?? candidates[0])?.id ?? null;
  };

  const unreadRoot = useMemo((): Agent | null => {
    let newest: Agent | null = null;
    for (const agent of sessionAgents) {
      if (agent.status === 'failed') {
        continue;
      }
      if (!agentHasUnread(agent, false)) {
        continue;
      }
      if (newest != null && (agent.lastFinishedAt ?? '') <= (newest.lastFinishedAt ?? '')) {
        continue;
      }
      newest = agent;
    }
    if (newest == null) {
      return null;
    }
    return resolveRootAgent({ agents: sessionAgents, agentId: newest.id });
  }, [sessionAgents]);

  const waitingItemId = ({ lens }: { readonly lens: AgentHomeLens }): string | null => {
    if (lens === 'agents') {
      return pickAgentId({ candidates: nonResolverAgents });
    }
    if (lens === 'resolve') {
      return pickAgentId({
        candidates: rawStandalone.filter(
          (agent) => classifyAgent(agent, agentKindOverride[agent.id] ?? null) === 'resolver',
        ),
      });
    }
    return unreadRoot?.workflowRunId ?? null;
  };

  const unreadLens: AgentHomeLens | null =
    unreadRoot === null
      ? null
      : agentHomeLens(
          unreadRoot,
          classifyAgent(unreadRoot, agentKindOverride[unreadRoot.id] ?? null),
        );

  const waiting: WaitingAgent | null =
    unreadLens === null
      ? null
      : {
          lens: unreadLens,
          agentId: waitingItemId({ lens: unreadLens }),
          isResolver: unreadLens === 'resolve',
        };

  const stalledStep = useMemo((): StalledStep | null => {
    for (const lane of [
      ...runs.lanes,
      ...(runs.blockedLanes ?? []),
      ...(runs.completedLanes ?? []),
    ]) {
      const step = lane.steps.find((candidate) => candidate.status === 'stalled');
      if (step == null) {
        continue;
      }
      return { runId: lane.runId, name: step.name };
    }
    return null;
  }, [runs.lanes, runs.blockedLanes, runs.completedLanes]);

  const runningAgent = useMemo((): RunningAgent | null => {
    const running = sessionAgents.filter((agent) => agent.status === 'running');
    if (running.length === 0) {
      return null;
    }
    const latest = running.reduce((best, agent) => (agent.ordinal > best.ordinal ? agent : best));
    const root = resolveRootAgent({ agents: sessionAgents, agentId: latest.id }) ?? latest;
    const lens = agentHomeLens(root, classifyAgent(root, agentKindOverride[root.id] ?? null));
    if (lens === 'workflows') {
      return { lens, itemId: root.workflowRunId ?? null };
    }
    return { lens, itemId: root.id };
  }, [sessionAgents, agentKindOverride]);

  const upcomingStep = useMemo((): UpcomingStep | null => {
    for (const run of activeRuns) {
      const workflow = workflowById.get(run.workflowId);
      if (workflow === undefined) {
        continue;
      }
      const runAgents = runsForWorkflowRun(sessionAgents, run.id);
      const chain = classifyWorkflowChain(workflow, runAgents);
      if (chain.kind !== 'step') {
        continue;
      }
      const stepIsRunning = runAgents.some(
        (agent) => agent.stepId === chain.step.id && agent.status === 'running',
      );
      if (stepIsRunning) {
        continue;
      }
      return {
        runId: run.id,
        name: chain.step.name,
        workflowName: workflow.name,
        remaining: upcomingSteps(workflow, runAgents).length,
      };
    }
    return null;
  }, [activeRuns, workflowById, sessionAgents]);

  const nextUp = selectNextUp({
    openQuestions,
    questionBlocksRun,
    pr: pullRequest,
    waiting,
    stalledStep,
    sessionStateKind: session.state.kind,
    isFresh,
    runningAgent,
    resolveCount,
    pendingResolutions: pendingResolutionCount,
    upcomingStep,
  });

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  const actOnNextUp = ({ item }: { readonly item: NextUpItem }) => {
    if (item.lens === null) {
      openWorkflowBuilder();
      return;
    }
    if (item.lens === 'workflows' && item.itemId != null) {
      setFocusedWorkflowRun(sessionId, item.itemId);
      onSelectLens('workflows');
      return;
    }
    if (item.itemId != null && (item.lens === 'agents' || item.lens === 'resolve')) {
      onSelectLens(item.lens);
      void selectAgent(sessionId, agentIdFromString({ value: item.itemId }));
      return;
    }
    onSelectLens(item.lens);
  };

  return (
    <InspectorSplit
      open={isGoalHistoryOpen}
      panel={
        isGoalHistoryOpen ? (
          <SlotHistoryPanel
            label="Goal"
            renderAsMarkdown={false}
            entries={goalHistory}
            onRestore={(entry) => {
              void upsertSessionSlot(sessionId, 'goal', entry.value);
              setIsGoalHistoryOpen(false);
            }}
            onClose={() => setIsGoalHistoryOpen(false)}
          />
        ) : null
      }
    >
      <PaneShell
        header={<HeaderBand session={session} stage={stage} onSelectLens={onSelectLens} />}
        animationClassName="animate-fade-in"
      >
        <GoalOverviewRegion
          sessionId={sessionId}
          value={goalSlot?.value ?? ''}
          historyCount={goalHistoryCount}
          isLoading={goalSlot == null && slotLoading.slots}
          isSummarizing={summarizer.status === 'running'}
          onOpenHistory={() => {
            void loadSlotHistory(sessionId, 'goal');
            setIsGoalHistoryOpen(true);
          }}
        />
        <section aria-label="Next up" className="flex flex-col gap-2">
          <Eyebrow label="Next up" muted className="px-0.5 font-medium" />
          {nextUp !== null ? (
            <NextUpCard item={nextUp} onAct={() => actOnNextUp({ item: nextUp })} />
          ) : (
            <LensEmptyState
              icon={CONCEPT_ICONS.nextUp}
              tone={CONCEPT_TONE.nextUp}
              title="Nothing needs you right now"
              description="Every agent, question, and review on this session is settled. Start work from the timeline below."
            />
          )}
        </section>
        {isFresh ? (
          <section aria-label="Start work" className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Choose a workflow for a sequence, or one agent for a single task.
            </p>
            <button
              type="button"
              onClick={openWorkflowBuilder}
              className="flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3 py-3 text-left"
            >
              <StartRowContent
                icon={CONCEPT_ICONS.workflows}
                tone="accent"
                label="Workflow"
                description="Runs a multi-step task from plan through review."
              />
            </button>
            <CreateAgentPopover
              sessionId={sessionId}
              className="flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3 py-3 text-left"
              description="Spawns one agent on a single task with the session context."
            />
          </section>
        ) : (
          <div className="flex items-center justify-end px-0.5">
            <OverviewActions sessionId={sessionId} onOpenWorkflowBuilder={openWorkflowBuilder} />
          </div>
        )}
        <TimelinePane
          session={session}
          suppressOpenQuestions={nextUp?.id === 'question'}
          runs={runs}
        />
      </PaneShell>
    </InspectorSplit>
  );
};
