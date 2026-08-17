import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive } from 'lucide-react';
import { CountToggle, StatusDot } from '@goodboy/ui';
import type { DiffComment, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../../store';
import { notifyWorkflowGateBlock } from '../../../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { workflowRunHasOpenQuestions } from '../../../../../context/openQuestionsGate';
import {
  resolveWorkflowAdvance,
  type WorkflowAdvanceState,
} from '../../../../../workflows/advanceGate';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import {
  buildTimelineGroups,
  type TimelineTopLevelEntry,
} from '../../../../timeline/buildTimelineGroups';
import { formatCardTime } from '../../../../../chat/utils/format-card-time';
import { sessionCreationLabel } from '../../../SessionOverviewPane/sessionCreationLabel';
import { TimelineAgentRow } from './TimelineAgentRow';
import { TimelineArtifactRow } from './TimelineArtifactRow';
import { TimelineNowRow } from './TimelineNowRow';
import { TimelineQuestionInset } from './TimelineQuestionInset';
import { TimelineRunRow } from './TimelineRunRow';
import type { WorkspaceRuns } from '../../../../../orchestration/hooks/useWorkspaceRuns';

type Props = {
  readonly session: Session;
  readonly suppressOpenQuestions?: boolean;
  readonly runs: WorkspaceRuns;
};

type AtParams = {
  readonly at: string;
};

type QuietDaysParams = {
  readonly newerAt: string;
  readonly olderAt: string;
};

type AdvanceDetailParams = {
  readonly state: WorkflowAdvanceState;
};

type RenderEntryParams = {
  readonly entry: TimelineTopLevelEntry;
};

type AdvanceAgentParams = {
  readonly agentId: string;
};

const dayKey = ({ at }: AtParams): string => at.slice(0, 10);

const dayLabel = ({ at }: AtParams): string => {
  const date = new Date(at);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date);
};

const quietDaysBetween = ({ newerAt, olderAt }: QuietDaysParams): number => {
  const dayMs = 24 * 60 * 60 * 1000;
  const newer = new Date(`${dayKey({ at: newerAt })}T00:00:00Z`).getTime();
  const older = new Date(`${dayKey({ at: olderAt })}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((newer - older) / dayMs) - 1);
};

const advanceDetail = ({ state }: AdvanceDetailParams): string => {
  if (state.kind === 'complete') {
    return '';
  }
  if (state.kind === 'ready') {
    return 'ready to start';
  }
  if (state.kind === 'automatic') {
    return 'automation is advancing';
  }
  if (state.reason === 'questions') {
    return 'waiting for answers';
  }
  if (state.reason === 'summarizer') {
    return 'waiting for the handoff';
  }
  if (state.reason === 'failed-step') {
    return 'a step failed';
  }
  return 'waiting for running work';
};

export const TimelinePane = ({ session, suppressOpenQuestions = false, runs }: Props) => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const sessionCreations = useAppStore((s) => s.sessionCreations?.[sessionId] ?? EMPTY_ARRAY);
  const pendingResolutionCount = useAppStore(
    (s) => s.sessionPendingResolutions?.[sessionId]?.length ?? 0,
  );
  const diffComments = useAppStore((s) => s.diffComments?.[sessionId] ?? EMPTY_ARRAY);
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const emitNotification = useAppStore((s) => s.emitNotification);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const isSummarizerRunning = useAppStore(
    (s) => s.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const hasRunningTurn = useAppStore((s) =>
    agents.some((agent) => {
      const turn = s.agentTurnState?.[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const questions = useSessionOpenQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });
  const metrics = useAgentMetrics({ sessionId });
  const [isEarlierShown, setIsEarlierShown] = useState(false);

  useEffect(() => {
    void loadDiffComments(sessionId);
  }, [loadDiffComments, sessionId]);

  const model = useMemo(
    () =>
      buildTimelineGroups({
        agents,
        workflows,
        plans,
        externalTasks,
        questions,
        worktrees,
        agentKindOverride,
      }),
    [agentKindOverride, agents, externalTasks, plans, questions, workflows, worktrees],
  );
  const advanceByRunId = useMemo(() => {
    const states = new Map<string, WorkflowAdvanceState>();
    for (const attached of workflows) {
      const runAgents = agents.filter(
        (agent) =>
          agent.workflowRunId === attached.run.id &&
          agent.parentAgentId == null &&
          agent.stepId != null,
      );
      states.set(
        attached.run.id,
        resolveWorkflowAdvance({
          workflow: attached.workflow,
          agents: runAgents,
          hasOpenQuestions: workflowRunHasOpenQuestions(questions, attached.run.id),
          isSummarizerRunning,
          isTurnRunning: hasRunningTurn,
          isAutoRun: attached.run.autoRun === true,
        }),
      );
    }
    return states;
  }, [agents, hasRunningTurn, isSummarizerRunning, questions, workflows]);
  const diffCommentByAgentId = useMemo(() => {
    const comments = new Map<string, DiffComment>();
    for (const comment of diffComments) {
      if (comment.consumedByAgentId != null) {
        comments.set(comment.consumedByAgentId, comment);
      }
    }
    return comments;
  }, [diffComments]);
  const openDiffComments = diffComments.filter(
    (comment) => comment.status === 'open' && comment.consumedByAgentId == null,
  );
  const visibleEntries = isEarlierShown ? model.entries : model.entries.slice(0, 30);
  const earlierCount = Math.max(0, model.entries.length - 30);
  let previousDay = '';
  let previousEntryAt: string | null = null;

  const advanceAgent = async ({ agentId }: AdvanceAgentParams) => {
    const agent = agents.find((candidate) => candidate.id === agentId) ?? null;
    if (agent == null || agent.status !== 'pending') {
      return;
    }
    try {
      await activateWorkflowAgent({ sessionId, agentId: agent.id, focus: 'none' });
    } catch (error) {
      notifyWorkflowGateBlock({ error, sessionId, emitNotification });
    }
  };

  const renderEntry = ({ entry }: RenderEntryParams) => {
    const timeLabel = formatCardTime(entry.at);
    if (entry.kind === 'run') {
      const advanceState = advanceByRunId.get(entry.run.id) ?? { kind: 'complete' };
      return (
        <TimelineRunRow
          key={entry.id}
          entry={entry}
          sessionId={sessionId}
          aggregatesByAgentId={metrics.aggregatesByAgentId}
          timeLabel={timeLabel}
          advanceState={advanceState}
          onAdvance={({ agentId }) => void advanceAgent({ agentId })}
          diffCommentByAgentId={diffCommentByAgentId}
        />
      );
    }
    if (entry.kind === 'agent') {
      const aggregate = metrics.aggregatesByAgentId.get(entry.agent.id) ?? null;
      return (
        <TimelineAgentRow
          key={entry.id}
          entry={entry}
          sessionId={sessionId}
          estimatedCostUsd={
            aggregate != null && aggregate.turns > 0 ? aggregate.estimatedCostUsd : null
          }
          timeLabel={timeLabel}
          diffComment={diffCommentByAgentId.get(entry.agent.id) ?? null}
        />
      );
    }
    return (
      <TimelineArtifactRow
        key={entry.id}
        entry={entry}
        sessionId={sessionId}
        timeLabel={timeLabel}
      />
    );
  };

  return (
    <section aria-label="Timeline" className="flex flex-col">
      <div className="grid min-h-9 grid-cols-[44px_24px_minmax(0,1fr)]">
        <span />
        <div className="relative flex items-center justify-center">
          <span className="absolute inset-y-1/2 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <span className="relative z-10 flex size-4 items-center justify-center rounded-full bg-elevated ring-1 ring-border">
            {agents.some((agent) => agent.status === 'running') ? (
              <StatusDot tone="info" size="sm" pulsing ariaLabel="Work running" />
            ) : (
              <span className="size-2 rounded-full ring-1 ring-border" aria-label="Now" />
            )}
          </span>
        </div>
        <span className="self-center text-2xs font-medium uppercase text-muted-foreground">
          Now
        </span>
      </div>
      {!suppressOpenQuestions
        ? model.now
            .filter((item) => item.kind === 'question')
            .map((item) =>
              item.kind === 'question' ? (
                <div key={item.id} className="grid grid-cols-[44px_24px_minmax(0,1fr)]">
                  <span />
                  <span className="border-l border-border" />
                  <TimelineQuestionInset question={item.question} sessionId={sessionId} />
                </div>
              ) : null,
            )
        : null}
      {sessionCreations.map((creation) => (
        <TimelineNowRow
          key={creation.id}
          tone="info"
          label={sessionCreationLabel({ creation })}
          isRunning
        />
      ))}
      {workflows.map((attached) => {
        const state = advanceByRunId.get(attached.run.id) ?? { kind: 'complete' };
        if (state.kind !== 'blocked' || state.reason === 'turn-running') {
          return null;
        }
        return (
          <TimelineNowRow
            key={`gate:${attached.run.id}`}
            icon={AlertTriangle}
            tone="warning"
            label={`${state.step.name} is next in ${attached.workflow.name}`}
            detail={advanceDetail({ state })}
            action="Open run"
            onClick={() => {
              useAppStore.getState().setFocusedWorkflowRun(sessionId, attached.run.id);
              setActiveLens(sessionId, 'workflows');
            }}
          />
        );
      })}
      {[...runs.lanes, ...(runs.blockedLanes ?? []), ...(runs.completedLanes ?? [])].flatMap(
        (lane) =>
          lane.steps
            .filter((step) => step.status === 'stalled')
            .map((step) => (
              <TimelineNowRow
                key={`stalled:${lane.runId}:${step.name}`}
                icon={AlertTriangle}
                tone="warning"
                label={step.name}
                detail="stalled"
                action="Restart the step"
                onClick={() => {
                  useAppStore.getState().setFocusedWorkflowRun(sessionId, lane.runId);
                  setActiveLens(sessionId, 'workflows');
                }}
              />
            )),
      )}
      {model.now
        .filter((item) => item.kind === 'agent')
        .map((item) =>
          item.kind === 'agent' ? (
            <TimelineNowRow
              key={item.id}
              icon={CONCEPT_ICONS.agents}
              tone="neutral"
              label={item.agent.name}
              detail="created, not started"
              action="Open chat"
              onClick={() => void selectAgent(sessionId, item.agent.id)}
            />
          ) : null,
        )}
      {pendingResolutionCount > 0 ? (
        <TimelineNowRow
          icon={CONCEPT_ICONS.resolve}
          tone="success"
          label={
            pendingResolutionCount === 1
              ? '1 pending resolution'
              : `${pendingResolutionCount} pending resolutions`
          }
          action="Open resolve"
          onClick={() => setActiveLens(sessionId, 'resolve')}
        />
      ) : null}
      {openDiffComments.length > 0 ? (
        <TimelineNowRow
          icon={CONCEPT_ICONS.review}
          tone="warning"
          label={
            openDiffComments.length === 1
              ? '1 open diff comment'
              : `${openDiffComments.length} open diff comments`
          }
          action="Open diff"
          onClick={() => setActiveLens(sessionId, 'files')}
        />
      ) : null}
      {visibleEntries.map((entry) => {
        const currentDay = dayKey({ at: entry.at });
        const showsDay = currentDay !== previousDay;
        const quietDays =
          previousEntryAt == null
            ? 0
            : quietDaysBetween({ newerAt: previousEntryAt, olderAt: entry.at });
        previousDay = currentDay;
        previousEntryAt = entry.at;
        return (
          <div key={entry.id} className="flex flex-col">
            {quietDays > 2 ? (
              <div className="grid min-h-7 grid-cols-[44px_24px_minmax(0,1fr)]">
                <span />
                <span className="border-l border-dashed border-border" />
                <span className="self-center text-3xs text-muted-foreground">
                  {quietDays} quiet days
                </span>
              </div>
            ) : null}
            {showsDay ? (
              <div className="grid min-h-7 grid-cols-[44px_24px_minmax(0,1fr)] bg-canvas">
                <span />
                <span className="border-l border-border" />
                <span className="self-center text-2xs font-medium uppercase text-muted-foreground">
                  {dayLabel({ at: entry.at })}
                </span>
              </div>
            ) : null}
            {renderEntry({ entry })}
          </div>
        );
      })}
      {earlierCount > 0 ? (
        <div className="flex justify-center py-2">
          <CountToggle
            label="Earlier"
            itemsLabel="entries"
            count={earlierCount}
            isShown={isEarlierShown}
            icon={Archive}
            onChange={setIsEarlierShown}
          />
        </div>
      ) : null}
    </section>
  );
};
