import type {
  AgentId,
  AgentSourceKind,
  MountId,
  PlanId,
  PrMergeMethod,
  ProjectId,
  ProviderId,
  PullRequestState,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  pendingMountEvents,
  type SuggestionMountEvent,
} from '../../store/slices/project-mounts/materializationProposals';
import type { BranchPushState } from '../../shared/lib/branchPushState';
import type { PendingAgentSignal } from './pendingAgentSignal';
import { isFresh, applyDismissals, dedupeByTargetKey, sortNextSteps } from './nextStepGates';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import type { AgentKind } from '../session/agent-kind';
import { fixChecksSuggestionOf } from './fixChecksSuggestionOf';
import { cleanupSuggestionOf } from './cleanupSuggestionOf';
import { openPrSuggestionOf } from './openPrSuggestionOf';
import { isOfferedByActivity } from './isOfferedByActivity';
import { isMountBusyOf } from './isMountBusyOf';
import { mountLabelOf } from './mountLabelOf';
import type {
  FixChecksProgress,
  OpenPrTarget,
  RebaseSuggestionTarget,
  ScribeRequestState,
  SessionSuggestion,
  SuggestionKind,
  SuggestionQuestion,
} from './types';

type SuggestionWorkflowRun = {
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
};

export type SuggestionCheckChain = FixChecksProgress & {
  readonly mountId: MountId;
};

type SuggestionRecommendedWorkflow = {
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
};

type SuggestionPlan = {
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

type SuggestionProject = {
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
};

type MountParams = {
  readonly mountId: MountId;
};

type ProjectParams = {
  readonly project: SuggestionProject;
};

const dirtyCountOf = ({ project }: ProjectParams): number =>
  project.isClean === false ? Math.max(project.changedCount ?? 1, 1) : 0;

const isRebaseConsumed = ({ project }: ProjectParams): boolean => {
  const request = project.rebaseRequest ?? null;
  if (request == null || request.agentStatus === 'failed') {
    return false;
  }
  if (request.baseBranch != null && request.baseBranch !== project.baseBranch) {
    return false;
  }
  return request.behind === project.mainDistance;
};

type PushSuggestionParams = {
  readonly mount: SuggestionMount;
  readonly sessionId: SessionId;
};

type PushSuggestion = Extract<SessionSuggestion, { readonly kind: 'push-branch' }>;

const commitsLabel = (count: number): string => `${count} ${count === 1 ? 'commit' : 'commits'}`;

const pushSuggestionOf = ({ mount, sessionId }: PushSuggestionParams): PushSuggestion | null => {
  const push = mount.push;
  if (push === null) {
    return null;
  }
  const base = {
    id: `push-branch:${mount.mountId}`,
    kind: 'push-branch' as const,
    priority: 41,
    band: 2 as const,
    sessionId,
    targetKey: `branch:${mount.mountId}`,
  };
  const target = {
    mountId: mount.mountId,
    projectId: mount.projectId,
    projectName: mount.projectName,
    branch: mount.branch,
    worktreePath: mount.worktreePath,
  };
  if (push.kind === 'diverged') {
    return {
      ...base,
      title: 'Branch diverged from origin',
      detail: `${commitsLabel(push.ahead)} here, ${commitsLabel(push.behind)} on origin`,
      fingerprint: `push-branch:${mount.mountId}:diverged:${push.ahead}:${push.behind}`,
      payload: { ...target, state: 'diverged', ahead: push.ahead, behind: push.behind },
    };
  }
  if (mount.isClean === false) {
    return null;
  }
  if (push.kind === 'ahead') {
    return {
      ...base,
      title: `Push ${commitsLabel(push.ahead)}`,
      detail: `${mount.projectName} · ${mount.branch}`,
      fingerprint: `push-branch:${mount.mountId}:${push.ahead}`,
      payload: { ...target, state: 'ahead', ahead: push.ahead, behind: 0 },
    };
  }
  if (push.kind === 'not-pushed' && push.commits !== null && push.commits > 0) {
    return {
      ...base,
      title: 'Push the branch',
      detail: `Not pushed yet · ${commitsLabel(push.commits)}`,
      fingerprint: `push-branch:${mount.mountId}:new:${push.commits}`,
      payload: { ...target, state: 'not-pushed', ahead: push.commits, behind: 0 },
    };
  }
  return null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRuns: ReadonlyArray<SuggestionWorkflowRun>;
  readonly plans: ReadonlyArray<SuggestionPlan>;
  readonly consumedPlanIds: ReadonlySet<PlanId>;
  readonly openQuestionCount: number;
  readonly firstOpenQuestion?: SuggestionQuestion | null;
  readonly hasPullRequest: boolean;
  readonly eligibleThreadCount: number;
  readonly projects: ReadonlyArray<SuggestionProject>;
  readonly mountEvents: ReadonlyArray<SuggestionMountEvent>;
  readonly agents?: ReadonlyArray<SuggestionAgent>;
  readonly mounts?: ReadonlyArray<SuggestionMount>;
  readonly cleanupProposals?: ReadonlyArray<SuggestionCleanupProposal>;
  readonly checkChains?: ReadonlyArray<SuggestionCheckChain>;
  readonly isActivityShown?: boolean;
  readonly hasGoal?: boolean;
  readonly hasEverAttachedWorkflow?: boolean;
  readonly recommendedWorkflow?: SuggestionRecommendedWorkflow | null;
  readonly now?: () => number;
  readonly dismissedFingerprints?: ReadonlySet<string>;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
};

export const deriveNextSteps = ({
  sessionId,
  workflowRuns,
  plans,
  consumedPlanIds,
  openQuestionCount,
  firstOpenQuestion = null,
  hasPullRequest,
  eligibleThreadCount,
  projects,
  mountEvents,
  agents = [],
  mounts = [],
  cleanupProposals = [],
  checkChains = [],
  isActivityShown = true,
  hasGoal = false,
  hasEverAttachedWorkflow = workflowRuns.length > 0,
  recommendedWorkflow = null,
  now = () => Date.now(),
  dismissedFingerprints,
  demotedKinds,
}: Params): ReadonlyArray<SessionSuggestion> => {
  const suggestions: SessionSuggestion[] = [];
  for (const event of pendingMountEvents({ mountEvents })) {
    suggestions.push({
      id: `mount-project:${event.projectId}`,
      kind: 'mount-project',
      priority: 5,
      band: 1,
      title: `Add ${event.projectName}`,
      detail: event.reason,
      sessionId,
      targetKey: `project:${event.projectId}`,
      fingerprint: `mount-project:${event.projectId}:${event.eventId}`,
      payload: {
        projectId: event.projectId,
        projectName: event.projectName,
        reason: event.reason,
        agentId: event.agentId,
        eventId: event.eventId,
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
      payload: { count: openQuestionCount, firstQuestion: firstOpenQuestion },
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
      title: isSingle
        ? `Resume ${firstStopped.label}`
        : `Resume ${stoppedByRestart.length} stopped agents`,
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
  if (lastStandaloneAgent?.status === 'failed') {
    suggestions.push({
      id: `retry-agent:${lastStandaloneAgent.id}`,
      kind: 'retry-agent',
      priority: 11,
      band: 1,
      title: `Retry ${lastStandaloneAgent.label}`,
      detail: 'Stopped: the run failed',
      sessionId,
      targetKey: `agent:${lastStandaloneAgent.id}`,
      fingerprint: `retry-agent:${lastStandaloneAgent.id}`,
      payload: { agentId: lastStandaloneAgent.id, agentKind: lastStandaloneAgent.roleKind },
    });
  }
  if (
    lastStandaloneAgent?.status === 'completed' &&
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
  if (eligibleThreadCount > 0) {
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
  for (const mount of mounts) {
    const pr = mount.pr;
    if (
      pr == null ||
      pr.state === 'merged' ||
      pr.state === 'closed' ||
      !isFresh({ fetchedAt: mount.fetchedAt, now })
    ) {
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
    if (
      !isFresh({ fetchedAt: mount.fetchedAt, now }) ||
      isMountBusyOf({ agents, mountId: mount.mountId, mountCount: mounts.length })
    ) {
      continue;
    }
    const pr = mount.pr;
    if (pr != null && pr.state !== 'merged' && pr.state !== 'closed') {
      if (pr.isDraft && pr.checks === 'success') {
        suggestions.push({
          id: `mark-ready:${mount.mountId}`,
          kind: 'mark-ready',
          priority: 43,
          band: 2,
          title: `Mark #${pr.number} ready for review`,
          detail: 'All checks passed',
          sessionId,
          targetKey: `pr:${mount.mountId}`,
          fingerprint: `mark-ready:${mount.mountId}:${pr.number}`,
          payload: {
            mountId: mount.mountId,
            projectName: mount.projectName,
            prNumber: pr.number,
          },
        });
      }
      if (
        !pr.isDraft &&
        pr.reviewDecision === 'approved' &&
        pr.checks === 'success' &&
        pr.mergeable === true
      ) {
        suggestions.push({
          id: `merge-pr:${mount.mountId}`,
          kind: 'merge-pr',
          priority: 44,
          band: 2,
          title: `Merge #${pr.number}`,
          detail: 'Approved, checks passed',
          sessionId,
          targetKey: `pr:${mount.mountId}`,
          fingerprint: `merge-pr:${mount.mountId}:${pr.number}`,
          payload: {
            mountId: mount.mountId,
            projectName: mount.projectName,
            prNumber: pr.number,
            defaultMethod: 'squash',
          },
        });
      }
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
  const cleanup = cleanupSuggestionOf({ sessionId, proposals: cleanupProposals });
  if (cleanup !== null) {
    suggestions.push(cleanup);
  }
  const rebaseTargets: RebaseSuggestionTarget[] = [];
  const rebaseTargetIds = new Set<string>();
  for (const project of projects) {
    if (project.mainDistance == null || project.mainDistance <= 0) {
      continue;
    }
    if (isRebaseConsumed({ project })) {
      continue;
    }
    if (rebaseTargetIds.has(project.id)) {
      continue;
    }
    rebaseTargetIds.add(project.id);
    rebaseTargets.push({
      id: project.id,
      mountId: project.mountId,
      projectId: project.projectId,
      projectName: project.projectName,
      branch: project.branch,
      worktreePath: project.worktreePath,
      baseBranch: project.baseBranch,
      behind: project.mainDistance,
      dirtyCount: dirtyCountOf({ project }),
    });
  }
  const shownRebaseTargets = [...rebaseTargets].sort(
    (first, second) =>
      second.behind - first.behind || first.projectName.localeCompare(second.projectName),
  );
  const firstRebaseTarget = shownRebaseTargets[0];
  if (firstRebaseTarget != null) {
    const projectCount = new Set(shownRebaseTargets.map((target) => target.projectId)).size;
    const isSingleTarget = shownRebaseTargets.length === 1;
    const isSingleProject = projectCount === 1;
    const behindDetail = isSingleTarget
      ? `${firstRebaseTarget.behind} behind`
      : isSingleProject
        ? `${shownRebaseTargets.length} branches behind`
        : `${projectCount} folders behind`;
    suggestions.push({
      id: `rebase-project:${sessionId}`,
      kind: 'rebase-project',
      priority: 40,
      band: 2,
      title: isSingleTarget
        ? `Rebase ${mountLabelOf({ mount: firstRebaseTarget, siblings: projects })} on ${firstRebaseTarget.baseBranch}`
        : isSingleProject
          ? `Rebase ${firstRebaseTarget.projectName}`
          : `Rebase ${shownRebaseTargets.length} branches`,
      detail: behindDetail,
      sessionId,
      targetKey: null,
      fingerprint: `rebase-project:${sessionId}:${shownRebaseTargets.map((target) => `${target.id}:${target.behind}`).join(',')}`,
      payload: { targets: shownRebaseTargets },
    });
  }
  const deduped = dedupeByTargetKey({
    suggestions: isActivityShown
      ? suggestions.filter((suggestion) => !isOfferedByActivity({ suggestion }))
      : suggestions,
  });
  const kept = applyDismissals({ suggestions: deduped, dismissedFingerprints });
  return sortNextSteps({ suggestions: kept, demotedKinds });
};
