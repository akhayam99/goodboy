import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, SectionHeader, useCopyLink } from '@goodboy/ui';
import type {
  Agent,
  OpenQuestion,
  ProviderRunId,
  Session,
  SessionId,
  Step,
  TelemetryRecord,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useMountDiffStats,
  useSessionAnsweredQuestions,
  useSessionDismissedQuestions,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
  type MountDiffStat,
} from '../../../../../../store';
import { runSpendUsd } from '../../../../../../store/slices/workflows/runSpendUsd';
import { useSessionRoleModels } from '../../../../../../shared/hooks/useSessionRoleModels';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { useAdvanceWorkflowAgent } from '../../../../../workflows/useAdvanceWorkflowAgent';
import { useWorkflowAdvanceStates } from '../../../../../workflows/useWorkflowAdvanceStates';
import { filterTimelineEntries, isActivityChildShown } from '../../../../timeline/activityFilter';
import { agentSpendById } from '../../../../timeline/agentSpendById';
import { buildTimelineGroups } from '../../../../timeline/buildTimelineGroups';
import {
  buildTimelineStream,
  type TimelineRowItem,
} from '../../../../timeline/buildTimelineStream';
import { dayLabel } from '../../../../timeline/dayLabel';
import { layoutTimelineRail } from '../../../../../workTreeModel/railGeometry';
import { useOpenQuestions } from '../../../../../context/components/QuestionsTab/useOpenQuestions';
import { useActivityFilter } from '../../../../hooks/useActivityFilter';
import { useTimelineOpen } from '../../../../hooks/useTimelineOpen';
import { useSessionSuggestions } from '../../../../../suggestions';
import { useSuggestionActions } from '../../../../../suggestions/useSuggestionActions';
import { useTranscriptMountProposals } from '../../../../../suggestions/useTranscriptMountProposals';
import { transcriptOwnedProjectIds } from '../../../../../suggestions/transcriptMountProposals';
import { ActivityFilterButton } from './ActivityFilterButton';
import { TimelineSuggestionRow } from './TimelineSuggestionRow';
import { TimelineDayRule } from './TimelineDayRule';
import { TimelineNowRule } from './TimelineNowRule';
import { TimelineSkeleton } from './TimelineSkeleton';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';
import { TimelineAgentMeta } from './TimelineAgentMeta';
import { TimelineRunMeta } from './TimelineRunMeta';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly actions: ReactNode;
  readonly kickoff?: ReactNode;
};

export const TimelinePane = ({ session, actions, kickoff }: Props) => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const artifacts = useAppStore((s) => s.sessionArtifacts?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const areEventsLoaded = useAppStore((s) => s.sessionEvents?.[sessionId] !== undefined);
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const loadSessionEvents = useAppStore((s) => s.loadSessionEvents);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const orchestratingWorkflowRuns = useAppStore((s) => s.orchestratingWorkflowRuns);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const focusQuestion = useOpenQuestions((s) => s.focusQuestion);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const answeredQuestions = useSessionAnsweredQuestions(sessionId);
  const dismissedQuestions = useSessionDismissedQuestions(sessionId);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const loadSessionDismissedQuestions = useAppStore((s) => s.loadSessionDismissedQuestions);
  const workflows = useAttachedWorkflowRuns({ session });
  const openTargetFor = useTimelineOpen({ sessionId });
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });
  const activity = useActivityFilter();
  const suggestions = useSessionSuggestions({ session, agents });
  const transcriptProposals = useTranscriptMountProposals({ session });
  const transcriptOwned = useMemo(
    () => transcriptOwnedProjectIds({ proposals: transcriptProposals }),
    [transcriptProposals],
  );
  const suggestionActions = useSuggestionActions({
    session,
    agents,
    onSelectQuestions: () => setActiveLens(sessionId, 'questions'),
  });
  const diffStats = useMountDiffStats(sessionId);
  const roleModels = useSessionRoleModels({ sessionId });
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const history: Record<string, ReadonlyArray<ProviderRunId>> = {};
      for (const agent of s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)) {
        const runIds = s.agentRunHistory[agent.id];
        if (runIds != null) {
          history[agent.id] = runIds;
        }
      }
      return history;
    }),
  );
  const sessionProvider = session.providerPreference?.defaultProvider ?? null;
  const sessionEffort = session.effort ?? null;
  const { copiedKey, failedKey, copy } = useCopyLink();

  useEffect(() => {
    void loadSessionEvents({ sessionId });
  }, [loadSessionEvents, sessionId]);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [loadSessionArtifacts, sessionId]);

  useEffect(() => {
    void loadSessionAnsweredQuestions(sessionId);
    void loadSessionDismissedQuestions(sessionId);
  }, [loadSessionAnsweredQuestions, loadSessionDismissedQuestions, sessionId]);

  const questions = useMemo(
    () => [...openQuestions, ...answeredQuestions, ...dismissedQuestions],
    [answeredQuestions, dismissedQuestions, openQuestions],
  );

  const model = useMemo(
    () =>
      buildTimelineGroups({
        sessionId,
        agents,
        workflows,
        plans,
        artifacts,
        externalTasks,
        questions,
        worktrees,
        events,
        agentKindOverride,
      }),
    [
      agentKindOverride,
      agents,
      artifacts,
      events,
      externalTasks,
      plans,
      questions,
      sessionId,
      workflows,
      worktrees,
    ],
  );

  const visibleEntries = useMemo(
    () => filterTimelineEntries({ entries: model.entries, filter: activity.filter }),
    [activity.filter, model.entries],
  );

  const stepById = useMemo(() => {
    const steps = new Map<string, Step>();
    for (const { workflow } of workflows) {
      for (const step of workflow.steps) {
        steps.set(step.id, step);
      }
    }
    return steps;
  }, [workflows]);

  const spendByAgentId = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );

  const spendByRunId = useMemo(() => {
    const spend = new Map<string, number>();
    for (const { run } of workflows) {
      spend.set(
        run.id,
        runSpendUsd({ records: telemetry, agents, agentRunHistory, workflowRunId: run.id }),
      );
    }
    return spend;
  }, [agentRunHistory, agents, telemetry, workflows]);

  const advanceByRunId = useWorkflowAdvanceStates({ sessionId, workflows, agents });

  const unreadAgentIds = useMemo(() => {
    const unread = new Set<string>();
    for (const agent of agents) {
      if (agentHasUnread(agent, false)) {
        unread.add(agent.id);
      }
    }
    return unread;
  }, [agents]);

  const decidingRunIds = useMemo(() => {
    const deciding = new Set<string>();
    for (const { run } of workflows) {
      if (orchestratingWorkflowRuns?.[run.id] === true) {
        deciding.add(run.id);
      }
    }
    return deciding;
  }, [orchestratingWorkflowRuns, workflows]);

  const stream = useMemo(
    () =>
      buildTimelineStream({
        entries: visibleEntries,
        unreadAgentIds,
        advanceByRunId,
        decidingRunIds,
        dayLabelFor: dayLabel,
        showWorkflowSubagents: activity.filter.workflowSubagents,
        showAgentSubagents: activity.filter.agentSubagents,
        showPlans: isActivityChildShown({ filter: activity.filter, toggle: 'plans' }),
        showReports: isActivityChildShown({ filter: activity.filter, toggle: 'reports' }),
        showWireframes: isActivityChildShown({ filter: activity.filter, toggle: 'wireframes' }),
        showQuestions: activity.filter.questions,
      }),
    [activity.filter, advanceByRunId, decidingRunIds, unreadAgentIds, visibleEntries],
  );

  const rail = useMemo(
    () => layoutTimelineRail({ rows: stream.items, groups: stream.groups }),
    [stream.groups, stream.items],
  );

  const mountPathByProjectId = useMemo(() => {
    const paths = new Map<string, string>();
    for (const worktree of worktrees) {
      if (worktree.projectId != null) {
        paths.set(worktree.projectId, worktree.worktreePath);
      }
    }
    return paths;
  }, [worktrees]);

  const mountPathFor = ({ item }: { readonly item: TimelineRowItem }): string | null => {
    const { entry } = item;
    if (entry.kind === 'branch') {
      return entry.worktree.worktreePath;
    }
    if (entry.kind !== 'event' || entry.event.kind !== 'project_materialized') {
      return null;
    }
    if (entry.projectRun != null) {
      return null;
    }
    const projectId = entry.event.payload?.projectId ?? null;
    if (projectId == null) {
      return null;
    }
    return mountPathByProjectId.get(projectId) ?? null;
  };

  const diffStatFor = ({ item }: { readonly item: TimelineRowItem }): MountDiffStat | null => {
    const worktreePath = mountPathFor({ item });
    if (worktreePath == null) {
      return null;
    }
    return diffStats.get(worktreePath) ?? null;
  };

  const answerAction = ({
    question,
  }: {
    readonly question: OpenQuestion | null;
  }): TimelineRowAction => ({
    label: 'Answer',
    asksUser: true,
    onAct: () => {
      if (question != null) {
        focusQuestion(question.id);
      }
      setActiveLens(sessionId, 'questions');
    },
  });

  const actionFor = ({ item }: { readonly item: TimelineRowItem }): TimelineRowAction | null => {
    const { entry } = item;
    const mountPath = mountPathFor({ item });
    if (mountPath != null) {
      const stat = diffStatFor({ item });
      if (stat != null && (stat.additions > 0 || stat.deletions > 0)) {
        return {
          label: 'View diff',
          onAct: () => openMountDiff(sessionId, mountPath),
        };
      }
      return {
        label:
          copiedKey === mountPath
            ? 'Copied'
            : failedKey === mountPath
              ? 'Copy failed'
              : 'Copy path',
        onAct: () => void copy({ text: mountPath }),
      };
    }
    const { ask } = item.rowState;
    if (ask == null) {
      return null;
    }
    switch (ask.kind) {
      case 'answer':
        return answerAction({ question: ask.question });
      case 'restartStep': {
        const target = openTargetFor({ entry });
        if (target == null) {
          return null;
        }
        return { label: 'Restart the step', onAct: target.open };
      }
      case 'runStep': {
        const { agent } = ask;
        return {
          label: `Start ${ask.step.name}`,
          onAct: () => void advanceAgent({ agent }),
        };
      }
      default: {
        const exhaustive: never = ask;
        return exhaustive;
      }
    }
  };

  const metaFor = ({ item }: { readonly item: TimelineRowItem }): ReactNode => {
    const { entry } = item;
    if (entry.kind === 'run') {
      return <TimelineRunMeta entry={entry} costUsd={spendByRunId.get(entry.run.id) ?? 0} />;
    }
    if (entry.kind !== 'agent') {
      return null;
    }
    const { agent } = entry;
    return (
      <TimelineAgentMeta
        agent={agent}
        kind={entry.agentKind}
        step={agent.stepId == null ? null : (stepById.get(agent.stepId) ?? null)}
        roleModels={roleModels}
        sessionProvider={sessionProvider}
        sessionEffort={sessionEffort}
        costUsd={spendByAgentId.get(agent.id) ?? 0}
        shouldKeepCost={item.grade === 'entry'}
      />
    );
  };

  const hasUnreadAgents = unreadAgentIds.size > 0;
  const visibleSuggestions = activity.filter.suggestions
    ? suggestions.filter(
        (suggestion) =>
          suggestion.kind !== 'plan-ready' &&
          (suggestion.kind !== 'mount-project' ||
            !transcriptOwned.has(suggestion.payload.projectId)),
      )
    : [];
  const isLoading = (!areEventsLoaded || !areAgentsLoaded) && model.entries.length === 0;
  const emptyHint =
    areEventsLoaded && areAgentsLoaded && model.entries.length === 0
      ? 'Nothing yet. Agents, workflows and session facts land here as they happen.'
      : undefined;

  if (model.entries.length === 0 && kickoff != null && areEventsLoaded && areAgentsLoaded) {
    return <>{kickoff}</>;
  }

  return (
    <section aria-label="Activity" className="flex flex-col gap-2">
      <SectionHeader
        label="Activity"
        hint={emptyHint}
        className="px-0.5"
        action={
          <div className="flex items-center gap-1">
            {hasUnreadAgents ? (
              <Button variant="ghost" size="sm" onClick={() => void markAllAgentsSeen(sessionId)}>
                <CheckCheck size={ICON_SIZE.row} aria-hidden />
                Mark all seen
              </Button>
            ) : null}
            <ActivityFilterButton
              filter={activity.filter}
              hiddenCount={activity.hiddenCount}
              onToggle={activity.setToggle}
              onAll={activity.setAll}
            />
            {actions}
          </div>
        }
      />
      {isLoading ? (
        <TimelineSkeleton />
      ) : model.entries.length === 0 ? null : visibleEntries.length === 0 ? (
        <p className="px-0.5 py-2 text-xs text-muted-foreground">
          Everything is hidden by the activity filter. Show a category to bring it back.
        </p>
      ) : (
        <div className="@container flex flex-col">
          {visibleSuggestions.map((suggestion) => (
            <TimelineSuggestionRow
              key={suggestion.id}
              suggestion={suggestion}
              railWidth={rail.width}
              actions={suggestionActions({ suggestion })}
            />
          ))}
          {stream.items.map((item, index) => {
            const railRow = rail.rows[index];
            if (railRow === undefined) {
              return null;
            }
            if (item.kind === 'now') {
              return (
                <TimelineNowRule key={item.id} item={item} rail={railRow} railWidth={rail.width} />
              );
            }
            if (item.kind === 'day') {
              return (
                <TimelineDayRule key={item.id} item={item} rail={railRow} railWidth={rail.width} />
              );
            }
            const target = openTargetFor({ entry: item.entry });
            return (
              <TimelineStreamRow
                key={item.id}
                item={item}
                rail={railRow}
                railWidth={rail.width}
                sessionId={sessionId}
                openTarget={target}
                action={actionFor({ item })}
                diffStat={diffStatFor({ item })}
                meta={metaFor({ item })}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
