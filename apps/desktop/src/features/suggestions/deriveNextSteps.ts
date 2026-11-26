import type {
  AgentId,
  AgentSourceKind,
  MountId,
  PlanId,
  PrCheckConclusion,
  ProjectId,
  PullRequestState,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import { pendingMountEvents } from '../../store/slices/project-mounts/materializationProposals';
import type { BranchPushState } from '../../shared/lib/branchPushState';
import { continueAgentsTitleOf } from './continueAgentsTitleOf';
import type { PendingAgentSignal } from './pendingAgentSignal';
import { applyDismissals, dedupeByTargetKey, sortNextSteps } from './nextStepGates';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import type { AgentKind } from '../session/agent-kind';
import { fixChecksSuggestionOf } from './fixChecksSuggestionOf';
import { archiveSuggestionOf, type SettledBranches } from './archiveSuggestionOf';
import { cleanupSuggestionOf } from './cleanupSuggestionOf';
import { trackerMoveSuggestionOf } from './trackerMoveSuggestionOf';
import { seriesMergeSuggestionOf } from './seriesMergeSuggestionOf';
import { openPrSuggestionOf } from './openPrSuggestionOf';
import { readyAndMergeSuggestionsOf } from './readyAndMergeSuggestionsOf';
import { isOfferedByActivity } from './isOfferedByActivity';
import { isMountBusyOf } from './isMountBusyOf';
import { isSettledWorkOf } from './isSettledWorkOf';
import { pushSuggestionOf } from './pushSuggestionOf';
import { rebaseSuggestionOf } from './rebaseSuggestionOf';
import { keepOneUpkeep } from './keepOneUpkeep';
import { moveOf } from './moveOf';
import type { NextStepSignals } from './nextStepSignals';
import { askAgentSuggestionsOf } from './askAgentSuggestionsOf';
import { nextScriptSuggestionsOf } from './nextScriptSuggestionsOf';
import { rerunCheckSuggestionsOf } from './rerunCheckSuggestionsOf';
import { runFailingTestSuggestionsOf } from './runFailingTestSuggestionsOf';
import { unmountFolderSuggestionsOf } from './unmountFolderSuggestionsOf';
import { idleDaysOf } from './signals/idleDaysOf';
import type {
  FixChecksProgress,
  NextMove,
  OpenPrTarget,
  ScribeRequestState,
  SessionSuggestion,
} from './types';

export type SuggestionWorkflowRun = {
  readonly id: WorkflowRunId;
  readonly title: string;
  readonly advanceState: { readonly kind: string; readonly stepId?: StepId };
  readonly isRunning: boolean;
};

export type SuggestionAgent = {
  readonly id: AgentId;
  readonly label: string;
  readonly roleKind: AgentKind;
  readonly status: string;
  readonly workflowRunId: WorkflowRunId | null;
  readonly sourceKind?: AgentSourceKind;
  readonly ordinal: number;
  readonly pendingSignal: PendingAgentSignal | null;
  readonly isStoppedByRestart: boolean;
  readonly mountId?: MountId;
};

export type SuggestionMount = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly push: BranchPushState | null;
  readonly aheadOfBase: number | null;
  readonly isClean: boolean | null;
  readonly pr: PullRequestState | null;
  readonly fetchedAt: string | null;
  readonly scribe?: ScribeRequestState | null;
  readonly failedChecks?: ReadonlyArray<SuggestionFailedCheck>;
  readonly checks?: ReadonlyArray<SuggestionCheckOutcome>;
};

export type SuggestionFailedCheck = {
  readonly name: string;
  readonly detailsUrl: string | null;
};

export type SuggestionCheckOutcome = {
  readonly name: string;
  readonly conclusion: PrCheckConclusion;
};

export type SuggestionCheckChain = FixChecksProgress & {
  readonly mountId: MountId;
};

export type SuggestionRecommendedWorkflow = {
  readonly id: WorkflowId;
  readonly name: string;
};

export type SuggestionCleanupProposal = {
  readonly requestId: string;
  readonly mountId: MountId;
  readonly projectName: string;
  readonly branch: string;
  readonly prNumber: number | null;
  readonly sizeBytes: number | null;
  readonly isArchived: boolean;
  readonly mergedAt?: string | null;
  readonly idleDays?: number;
  readonly reason?: 'merge_cleanup' | 'unmount';
};

export type SuggestionPlan = {
  readonly id: PlanId;
  readonly title: string;
  readonly status: string;
  readonly creatorHasOpenQuestions: boolean;
  readonly isOwnedByRun: boolean;
};

export type SuggestionRebaseRequest = {
  readonly behind: number | null;
  readonly baseBranch: string | null;
  readonly agentStatus: string | null;
};

export type SuggestionProject = {
  readonly id: string;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly baseBranch: string;
  readonly mainDistance: number | null;
  readonly isClean?: boolean | null;
  readonly changedCount?: number | null;
  readonly rebaseRequest?: SuggestionRebaseRequest | null;
  readonly rebaseStop?: { readonly conflicts: number } | null;
};

type MountParams = {
  readonly mountId: MountId;
};

type MountKeyParams = {
  readonly mountId: MountId | null;
};

const NO_SETTLED_BRANCHES: SettledBranches = { merged: 0, closed: 0 };

const NO_IN_USE_MOUNTS: ReadonlySet<string> = new Set();

const LIVE_AGENT_STATUSES: ReadonlyArray<string> = ['running', 'pending', 'blocked'];

type Params = {
  readonly signals: NextStepSignals;
};

export const deriveNextSteps = ({ signals }: Params): ReadonlyArray<NextMove> => {
  const {
    sessionId,
    workflowRuns,
    plans,
    consumedPlanIds,
    openQuestionCount,
    firstOpenQuestion = null,
    questionsRootAgentId = null,
    eligibleThreadCount,
    reviewMountId = null,
    projects,
    mountEvents,
    agents = [],
    mounts = [],
    cleanupProposals = [],
    trackerMoves = [],
    seriesStrips = [],
    settledBranches = NO_SETTLED_BRANCHES,
    settledMountIds = [],
    checkChains = [],
    isActivityShown = true,
    hasGoal = false,
    hasEverAttachedWorkflow = workflowRuns.length > 0,
    recommendedWorkflow = null,
    now = () => Date.now(),
    dismissedFingerprints,
    demotedKinds,
    checkLogs = [],
    scripts = [],
    turnFiles = [],
    quietAgents = [],
    scriptRuns = [],
    mergedMounts = [],
    idleMounts = [],
    inUseMountIds = NO_IN_USE_MOUNTS,
  } = signals;
  const suggestions: SessionSuggestion[] = [];
  const settledMountIdSet = new Set<string>(settledMountIds);
  const isSettledWork = ({ mountId }: MountKeyParams): boolean =>
    isSettledWorkOf({ mountId, settledMountIds: settledMountIdSet, settledBranches });
  for (const event of pendingMountEvents({ mountEvents })) {
    const askCount = mountEvents.filter(
      (candidate) => candidate.kind === 'proposed' && candidate.projectId === event.projectId,
    ).length;
    const isRepeated = askCount >= 2;
    suggestions.push({
      id: `mount-project:${event.projectId}`,
      kind: 'mount-project',
      priority: isRepeated ? 4 : 5,
      band: 1,
      title: `Mount ${event.projectName}`,
      detail: isRepeated ? `${event.reason} · asked ${askCount} times` : event.reason,
      sessionId,
      targetKey: `project:${event.projectId}`,
      fingerprint: `mount-project:${event.projectId}:${event.eventId}`,
      payload: {
        projectId: event.projectId,
        projectName: event.projectName,
        reason: event.reason,
        agentId: event.agentId,
        eventId: event.eventId,
        ...(isRepeated && { askCount }),
      },
    });
  }
  if (openQuestionCount > 0) {
    suggestions.push({
      id: `answer-questions:${sessionId}`,
      kind: 'answer-questions',
      priority: 0,
      band: 0,
      title: 'Answer open questions',
      detail: `${openQuestionCount} ${openQuestionCount === 1 ? 'question' : 'questions'} blocking progress`,
      sessionId,
      targetKey: null,
      fingerprint: `answer-questions:${sessionId}:${openQuestionCount}`,
      payload: {
        count: openQuestionCount,
        firstQuestion: firstOpenQuestion,
        rootAgentId: questionsRootAgentId,
      },
    });
  }
  for (const agent of agents) {
    if (agent.pendingSignal?.kind === 'permission') {
      suggestions.push({
        id: `approve-tool:${agent.id}`,
        kind: 'approve-tool',
        priority: 1,
        band: 0,
        title: 'Approve a command',
        detail: `${agent.label} wants to run ${agent.pendingSignal.toolName}`,
        sessionId,
        targetKey: `agent:${agent.id}`,
        fingerprint: `approve-tool:${agent.id}:${agent.pendingSignal.toolUseId}`,
        payload: {
          agentId: agent.id,
          agentLabel: agent.label,
          toolUseId: agent.pendingSignal.toolUseId,
          toolName: agent.pendingSignal.toolName,
        },
      });
      continue;
    }
    if (agent.pendingSignal?.kind === 'auth') {
      const providerLabel = PROVIDER_LABEL[agent.pendingSignal.providerId];
      suggestions.push({
        id: `sign-in:${agent.id}`,
        kind: 'sign-in',
        priority: 2,
        band: 0,
        title: `Sign in to ${providerLabel}`,
        detail: `${agent.label} stopped: signed out`,
        sessionId,
        targetKey: `agent:${agent.id}`,
        fingerprint: `sign-in:${agent.id}:${agent.pendingSignal.providerId}`,
        payload: {
          agentId: agent.id,
          agentLabel: agent.label,
          providerId: agent.pendingSignal.providerId,
        },
      });
    }
  }
  const stoppedByRestart = agents.filter((agent) => agent.isStoppedByRestart);
  const firstStopped = stoppedByRestart[0];
  if (firstStopped !== undefined) {
    const isSingle = stoppedByRestart.length === 1;
    const agentIds = stoppedByRestart.map((agent) => agent.id);
    suggestions.push({
      id: `resume-agents:${sessionId}`,
      kind: 'resume-agents',
      priority: 3,
      band: 0,
      title: continueAgentsTitleOf({ labels: stoppedByRestart.map((agent) => agent.label) }),
      detail: 'Stopped when Goodboy closed. What they wrote is kept.',
      sessionId,
      targetKey: isSingle ? `agent:${firstStopped.id}` : null,
      fingerprint: `resume-agents:${sessionId}:${[...agentIds].sort().join(',')}`,
      payload: { agentIds },
    });
  }
  const lastStandaloneAgent = [...agents]
    .filter((agent) => agent.workflowRunId === null)
    .sort((first, second) => second.ordinal - first.ordinal)[0];
  const isLastAgentSettled =
    lastStandaloneAgent !== undefined &&
    isSettledWork({ mountId: lastStandaloneAgent.mountId ?? null });
  if (lastStandaloneAgent?.status === 'failed' && !isLastAgentSettled) {
    suggestions.push({
      id: `retry-agent:${lastStandaloneAgent.id}`,
      kind: 'retry-agent',
      priority: 11,
      band: 1,
      title: `Retry ${lastStandaloneAgent.label}`,
      detail: 'The run failed',
      sessionId,
      targetKey: `agent:${lastStandaloneAgent.id}`,
      fingerprint: `retry-agent:${lastStandaloneAgent.id}`,
      payload: { agentId: lastStandaloneAgent.id, agentKind: lastStandaloneAgent.roleKind },
    });
  }
  if (
    lastStandaloneAgent?.status === 'completed' &&
    !isLastAgentSettled &&
    lastStandaloneAgent.roleKind === 'implementer' &&
    lastStandaloneAgent.sourceKind !== 'failed_check'
  ) {
    suggestions.push({
      id: `check-changes:${lastStandaloneAgent.id}`,
      kind: 'check-changes',
      priority: 50,
      band: 3,
      title: 'Review the changes',
      detail: `${lastStandaloneAgent.label} finished without a reviewer`,
      sessionId,
      targetKey: `agent:${lastStandaloneAgent.id}`,
      fingerprint: `check-changes:${lastStandaloneAgent.id}`,
      payload: { agentId: lastStandaloneAgent.id },
    });
  }
  if (
    lastStandaloneAgent?.status === 'completed' &&
    !isLastAgentSettled &&
    (lastStandaloneAgent.roleKind === 'scout' || lastStandaloneAgent.roleKind === 'generic') &&
    hasGoal &&
    !hasEverAttachedWorkflow &&
    recommendedWorkflow != null
  ) {
    suggestions.push({
      id: `continue-with-workflow:${lastStandaloneAgent.id}`,
      kind: 'continue-with-workflow',
      priority: 52,
      band: 3,
      title: 'Continue with a workflow',
      detail: `${recommendedWorkflow.name} picks up from what ${lastStandaloneAgent.label} found`,
      sessionId,
      targetKey: `agent:${lastStandaloneAgent.id}`,
      fingerprint: `continue-with-workflow:${lastStandaloneAgent.id}:${recommendedWorkflow.id}`,
      payload: { workflowId: recommendedWorkflow.id, workflowName: recommendedWorkflow.name },
    });
  }
  for (const run of workflowRuns) {
    if (run.advanceState.kind !== 'ready' || run.advanceState.stepId == null) {
      continue;
    }
    suggestions.push({
      id: `workflow-next-step:${run.id}`,
      kind: 'workflow-next-step',
      priority: 10,
      band: 1,
      title: `Continue ${run.title}`,
      detail: 'The next step is ready to run',
      sessionId,
      targetKey: `workflow-run:${run.id}`,
      fingerprint: `workflow-next-step:${run.id}:${run.advanceState.stepId}`,
      payload: { runId: run.id, stepId: run.advanceState.stepId },
    });
  }
  const activePlan = [...plans].reverse().find((plan) => plan.status === 'active') ?? null;
  const hasRunningWorkflow = workflowRuns.some((run) => run.isRunning);
  if (
    activePlan != null &&
    !activePlan.creatorHasOpenQuestions &&
    !activePlan.isOwnedByRun &&
    !consumedPlanIds.has(activePlan.id) &&
    !hasRunningWorkflow
  ) {
    suggestions.push({
      id: `plan-ready:${activePlan.id}`,
      kind: 'plan-ready',
      priority: 20,
      band: 3,
      title: activePlan.title,
      detail: 'Ready to implement',
      sessionId,
      targetKey: `plan:${activePlan.id}`,
      fingerprint: `plan-ready:${activePlan.id}`,
      payload: { planId: activePlan.id },
    });
  }
  if (eligibleThreadCount > 0 && !isSettledWork({ mountId: reviewMountId })) {
    suggestions.push({
      id: `resolve-threads:${sessionId}`,
      kind: 'resolve-threads',
      priority: 30,
      band: 1,
      title: 'Fix review conversations',
      detail: `${eligibleThreadCount} ${eligibleThreadCount === 1 ? 'conversation' : 'conversations'}`,
      sessionId,
      targetKey: `pr:${sessionId}`,
      fingerprint: `resolve-threads:${sessionId}:${eligibleThreadCount}`,
      payload: { eligibleThreadCount },
    });
  }
  const progressOf = ({ mountId }: MountParams): FixChecksProgress | null =>
    checkChains.find((chain) => chain.mountId === mountId) ?? null;
  suggestions.push(...rerunCheckSuggestionsOf({ sessionId, mounts, checkLogs }));
  for (const mount of mounts) {
    const pr = mount.pr;
    if (pr == null || pr.state === 'merged' || pr.state === 'closed') {
      continue;
    }
    const progress = progressOf({ mountId: mount.mountId });
    if (pr.checks !== 'failure' && progress?.chain !== 'fixed-pushed') {
      continue;
    }
    if (!isActivityShown && progress?.chain === 'fixed-pushed' && progress.outcome !== 'failed') {
      continue;
    }
    if (isMountBusyOf({ agents, mountId: mount.mountId, mountCount: mounts.length })) {
      continue;
    }
    suggestions.push(
      fixChecksSuggestionOf({
        sessionId,
        mountId: mount.mountId,
        projectName: mount.projectName,
        pr,
        progress,
      }),
    );
  }
  const openPrTargets: OpenPrTarget[] = [];
  for (const mount of mounts) {
    if (isMountBusyOf({ agents, mountId: mount.mountId, mountCount: mounts.length })) {
      continue;
    }
    const pr = mount.pr;
    if (pr != null && pr.state !== 'merged' && pr.state !== 'closed') {
      suggestions.push(...readyAndMergeSuggestionsOf({ mount, pr, sessionId }));
    }
    if (pr == null && mount.aheadOfBase != null && mount.aheadOfBase > 0) {
      openPrTargets.push({
        mountId: mount.mountId,
        projectId: mount.projectId,
        projectName: mount.projectName,
        branch: mount.branch,
        worktreePath: mount.worktreePath,
        ahead: mount.aheadOfBase,
        scribe: mount.scribe ?? null,
      });
    }
    const push =
      progressOf({ mountId: mount.mountId })?.chain === 'fixed-local'
        ? null
        : pushSuggestionOf({ mount, sessionId });
    if (push !== null) {
      suggestions.push(push);
    }
  }
  const openPr = openPrSuggestionOf({
    sessionId,
    targets: openPrTargets,
    dismissedFingerprints,
  });
  if (openPr !== null) {
    suggestions.push(openPr);
  }
  for (const strip of seriesStrips) {
    const merge = seriesMergeSuggestionOf({ sessionId, strip });
    if (merge !== null) {
      suggestions.push(merge);
    }
  }
  for (const move of trackerMoves) {
    suggestions.push(trackerMoveSuggestionOf({ sessionId, move }));
  }
  const proposedMountIds = new Set(cleanupProposals.map((proposal) => proposal.mountId));
  const reachedCleanups: ReadonlyArray<SuggestionCleanupProposal> = [
    ...mergedMounts
      .filter((merged) => !merged.isProposed && !proposedMountIds.has(merged.mountId))
      .map((merged) => ({
        requestId: merged.requestId,
        mountId: merged.mountId,
        projectName: merged.projectName,
        branch: merged.branch,
        prNumber: merged.prNumber,
        sizeBytes: null,
        isArchived: false,
        mergedAt: merged.mergedAt,
        reason: 'merge_cleanup' as const,
      })),
    ...idleMounts.flatMap((idle): ReadonlyArray<SuggestionCleanupProposal> => {
      const idleDays = idleDaysOf({ lastTouchedMs: idle.lastTouchedMs, now });
      const isRemovable =
        idle.isRepo &&
        idle.isClean &&
        !idle.hasUnpushedWork &&
        !idle.hasOpenPr &&
        !idle.isProposed &&
        !proposedMountIds.has(idle.mountId) &&
        !mergedMounts.some((merged) => merged.mountId === idle.mountId);
      if (idleDays === null || !isRemovable) {
        return [];
      }
      return [
        {
          requestId: idle.requestId,
          mountId: idle.mountId,
          projectName: idle.projectName,
          branch: idle.branch,
          prNumber: null,
          sizeBytes: null,
          isArchived: false,
          idleDays,
          reason: 'unmount' as const,
        },
      ];
    }),
  ];
  const cleanup = cleanupSuggestionOf({
    sessionId,
    proposals: [...cleanupProposals, ...reachedCleanups].filter(
      (proposal) => !inUseMountIds.has(proposal.mountId),
    ),
    now,
  });
  if (cleanup !== null) {
    suggestions.push(cleanup);
  }
  suggestions.push(
    ...runFailingTestSuggestionsOf({ sessionId, mounts, checkLogs, scripts }),
    ...nextScriptSuggestionsOf({ sessionId, mounts, turnFiles, scripts, scriptRuns }),
    ...askAgentSuggestionsOf({ sessionId, quietAgents }),
    ...unmountFolderSuggestionsOf({ sessionId, idleMounts, now }),
  );
  const archive = archiveSuggestionOf({
    sessionId,
    settled: settledBranches,
    isBusy:
      openQuestionCount > 0 ||
      agents.some((agent) => LIVE_AGENT_STATUSES.includes(agent.status)) ||
      workflowRuns.some((run) => run.isRunning),
  });
  if (archive !== null) {
    suggestions.push(archive);
  }
  const rebase = rebaseSuggestionOf({ sessionId, projects });
  if (rebase !== null) {
    suggestions.push(rebase);
  }
  const deduped = dedupeByTargetKey({
    suggestions: isActivityShown
      ? suggestions.filter((suggestion) => !isOfferedByActivity({ suggestion }))
      : suggestions,
  });
  const kept = applyDismissals({ suggestions: deduped, dismissedFingerprints });
  const moves = sortNextSteps({ suggestions: kept, demotedKinds }).flatMap((suggestion) => {
    const move = moveOf({ suggestion, signals });
    return move === null ? [] : [move];
  });
  return keepOneUpkeep({ moves });
};
