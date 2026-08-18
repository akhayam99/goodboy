import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Archive, CheckCheck } from 'lucide-react';
import { Button, CountToggle, Eyebrow, StatusDot } from '@goodboy/ui';
import type { AgentId, DiffComment, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useSessionOpenQuestions,
} from '../../../../../../store';
import { notifyWorkflowGateBlock } from '../../../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { workflowRunHasOpenQuestions } from '../../../../../context/openQuestionsGate';
import {
  resolveWorkflowAdvance,
  type WorkflowAdvanceState,
} from '../../../../../workflows/advanceGate';
import { buildTimelineGroups } from '../../../../timeline/buildTimelineGroups';
import { flattenTimelineRows, withDayBreaks } from '../../../../timeline/flattenTimelineRows';
import { formatCardTime } from '../../../../../chat/utils/format-card-time';
import { dayLabel } from './dayLabel';
import { TimelineAgentRow } from './TimelineAgentRow';
import { TimelineAnswerRow } from './TimelineAnswerRow';
import { TimelineArtifactRow } from './TimelineArtifactRow';
import { TimelineDayRow } from './TimelineDayRow';
import { TimelineRunRow } from './TimelineRunRow';
import { TimelineSpine } from './TimelineSpine';
import type { WorkspaceRuns } from '../../../../../orchestration/hooks/useWorkspaceRuns';

type Props = {
  readonly session: Session;
  readonly runs: WorkspaceRuns;
  readonly actions: ReactNode;
};

const VISIBLE_LIMIT = 30;

export const TimelinePane = ({ session, runs, actions }: Props) => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const diffComments = useAppStore((s) => s.diffComments?.[sessionId] ?? EMPTY_ARRAY);
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const emitNotification = useAppStore((s) => s.emitNotification);
  const markAgentSeen = useAppStore((s) => s.markAgentSeen);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
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
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(new Set());

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

  const stalledRunIds = useMemo(() => {
    const stalled = new Set<string>();
    for (const lane of [
      ...runs.lanes,
      ...(runs.blockedLanes ?? []),
      ...(runs.completedLanes ?? []),
    ]) {
      if (lane.steps.some((step) => step.status === 'stalled')) {
        stalled.add(lane.runId);
      }
    }
    return stalled;
  }, [runs.lanes, runs.blockedLanes, runs.completedLanes]);

  const diffCommentByAgentId = useMemo(() => {
    const comments = new Map<string, DiffComment>();
    for (const comment of diffComments) {
      if (comment.consumedByAgentId != null) {
        comments.set(comment.consumedByAgentId, comment);
      }
    }
    return comments;
  }, [diffComments]);

  const liveRunIds = useMemo(() => {
    const live = new Set<string>();
    for (const entry of model.entries) {
      if (entry.kind !== 'run') {
        continue;
      }
      const steps = entry.children.flatMap((child) =>
        child.kind === 'agent' ? [child.agent] : [],
      );
      const isComplete =
        steps.length > 0 &&
        steps.every((agent) => agent.status === 'completed' || agent.status === 'skipped');
      if (!isComplete && entry.run.discardedAt == null) {
        live.add(entry.id);
      }
    }
    return live;
  }, [model.entries]);

  const expandedIds = useMemo(() => {
    const expanded = new Set(openedIds);
    for (const id of liveRunIds) {
      if (!collapsedIds.has(id)) {
        expanded.add(id);
      }
    }
    return expanded;
  }, [collapsedIds, liveRunIds, openedIds]);

  const toggle = (id: string) => {
    if (expandedIds.has(id)) {
      setOpenedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setCollapsedIds((current) => new Set(current).add(id));
      return;
    }
    setCollapsedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setOpenedIds((current) => new Set(current).add(id));
  };

  const rows = useMemo(
    () => flattenTimelineRows({ entries: model.entries, expandedIds }),
    [expandedIds, model.entries],
  );
  const visibleRows = isEarlierShown ? rows : rows.slice(0, VISIBLE_LIMIT);
  const earlierCount = Math.max(0, rows.length - VISIBLE_LIMIT);
  const items = useMemo(
    () => withDayBreaks({ rows: visibleRows, labelFor: dayLabel }),
    [visibleRows],
  );

  const hasUnreadAgents = agents.some((agent) => agentHasUnread(agent, false));
  const isAnyAgentRunning = agents.some((agent) => agent.status === 'running');

  const advanceAgent = async ({ agentId }: { readonly agentId: string }) => {
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

  const markSeen = (agentId: AgentId) => {
    void markAgentSeen(sessionId, agentId);
  };

  return (
    <section aria-label="Activity" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 px-0.5">
        <Eyebrow label="Activity" muted className="font-medium" />
        {hasUnreadAgents ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => void markAllAgentsSeen(sessionId)}
          >
            <CheckCheck size={13} aria-hidden />
            Mark all seen
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col">
        <div className="grid grid-cols-[52px_minmax(0,1fr)]">
          <span />
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative w-5 shrink-0 self-stretch">
              <span className="absolute bottom-0 left-1/2 top-1/2 w-px -translate-x-1/2 bg-border" />
              <span className="absolute left-1/2 top-1/2 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background ring-1 ring-border">
                {isAnyAgentRunning ? (
                  <StatusDot tone="info" size="md" pulsing ariaLabel="Work running" />
                ) : (
                  <span className="size-2 rounded-full bg-muted-foreground" aria-label="Now" />
                )}
              </span>
            </span>
            <span className="flex-1 py-1.5 text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
              Now
            </span>
            {actions}
          </div>
        </div>
        {items.map((item) => {
          if (item.kind === 'day') {
            const label = dayLabel({ at: item.at });
            return label === null ? null : (
              <TimelineDayRow key={item.id} label={label} identity={item.identity} />
            );
          }
          const { entry } = item;
          const timeLabel = item.at != null && item.depth === 0 ? formatCardTime(item.at) : null;
          if (entry.kind === 'run') {
            return (
              <TimelineRunRow
                key={item.id}
                entry={entry}
                sessionId={sessionId}
                timeLabel={timeLabel}
                advanceState={advanceByRunId.get(entry.run.id) ?? { kind: 'complete' }}
                hasStalledStep={stalledRunIds.has(entry.run.id)}
                isExpanded={expandedIds.has(entry.id)}
                onToggle={() => toggle(entry.id)}
                onAdvance={({ agentId }) => void advanceAgent({ agentId })}
              />
            );
          }
          if (entry.kind === 'agent') {
            return (
              <TimelineAgentRow
                key={item.id}
                entry={entry}
                sessionId={sessionId}
                timeLabel={timeLabel}
                depth={item.depth}
                identity={item.identity}
                diffComment={diffCommentByAgentId.get(entry.agent.id) ?? null}
                isExpanded={expandedIds.has(entry.id)}
                onToggle={() => toggle(entry.id)}
                onSeen={() => markSeen(entry.agent.id)}
              />
            );
          }
          if (entry.kind === 'answer') {
            return (
              <TimelineAnswerRow
                key={item.id}
                entry={entry}
                indent={item.depth}
                identity={item.identity}
                onOpen={() => setActiveLens(sessionId, 'questions')}
              />
            );
          }
          return (
            <TimelineArtifactRow
              key={item.id}
              entry={entry}
              sessionId={sessionId}
              timeLabel={timeLabel}
              indent={item.depth}
              identity={item.identity}
            />
          );
        })}
        {earlierCount > 0 ? (
          <div className="grid grid-cols-[52px_minmax(0,1fr)]">
            <span />
            <div className="flex min-w-0 items-stretch">
              <TimelineSpine identity={null} />
              <div className="flex flex-1 py-2 pl-2">
                <CountToggle
                  label="Earlier"
                  itemsLabel="entries"
                  count={earlierCount}
                  isShown={isEarlierShown}
                  icon={Archive}
                  onChange={setIsEarlierShown}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
