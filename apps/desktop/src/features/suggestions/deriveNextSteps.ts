import type {
  AgentId,
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
import type {
  RebaseSuggestionTarget,
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
  readonly ordinal: number;
  readonly pendingSignal: PendingAgentSignal | null;
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
};

type SuggestionPlan = {
  readonly id: PlanId;
  readonly title: string;
  readonly status: string;
  readonly creatorHasOpenQuestions: boolean;
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
  readonly rebaseRequest?: SuggestionRebaseRequest | null;
};

const isRebaseConsumed = ({ project }: { readonly project: SuggestionProject }): boolean => {
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
  readonly hasRunningAgent?: boolean;
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
  hasRunningAgent = false,
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
    lastStandaloneAgent.roleKind === 'implementer'
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
  if (hasPullRequest && eligibleThreadCount > 0) {
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
  if (!hasRunningAgent) {
    for (const mount of mounts) {
      if (!isFresh({ fetchedAt: mount.fetchedAt, now })) {
        continue;
      }
      const pr = mount.pr;
      if (pr != null && pr.state !== 'merged' && pr.state !== 'closed') {
        if (pr.checks === 'failure') {
          suggestions.push({
            id: `fix-checks:${mount.mountId}`,
            kind: 'fix-checks',
            priority: 12,
            band: 1,
            title: `Fix failing checks on #${pr.number}`,
            detail: `${mount.projectName} · checks failed`,
            sessionId,
            targetKey: `pr:${mount.mountId}`,
            fingerprint: `fix-checks:${mount.mountId}:${pr.number}`,
            payload: {
              mountId: mount.mountId,
              projectName: mount.projectName,
              prNumber: pr.number,
            },
          });
        }
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
        suggestions.push({
          id: `open-pr:${mount.mountId}`,
          kind: 'open-pr',
          priority: 42,
          band: 2,
          title: `Open a pull request for ${mount.projectName}`,
          detail: `${mount.aheadOfBase} ${mount.aheadOfBase === 1 ? 'commit' : 'commits'} ahead`,
          sessionId,
          targetKey: `pr:${mount.mountId}`,
          fingerprint: `open-pr:${mount.mountId}:${mount.aheadOfBase}`,
          payload: {
            mountId: mount.mountId,
            projectId: mount.projectId,
            projectName: mount.projectName,
            ahead: mount.aheadOfBase,
          },
        });
      }
      const push = pushSuggestionOf({ mount, sessionId });
      if (push !== null) {
        suggestions.push(push);
      }
    }
  }
  for (const proposal of cleanupProposals) {
    suggestions.push({
      id: `close-worktree:${proposal.mountId}`,
      kind: 'close-worktree',
      priority: 51,
      band: 3,
      title: `Close the ${proposal.projectName} worktree`,
      detail: proposal.prNumber == null ? 'Ready to remove' : `#${proposal.prNumber} merged`,
      sessionId,
      targetKey: `worktree:${proposal.mountId}`,
      fingerprint: `close-worktree:${proposal.requestId}`,
      payload: {
        mountId: proposal.mountId,
        requestId: proposal.requestId,
        branch: proposal.branch,
        prNumber: proposal.prNumber,
      },
    });
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
    });
  }
  rebaseTargets.sort(
    (first, second) =>
      second.behind - first.behind || first.projectName.localeCompare(second.projectName),
  );
  const firstRebaseTarget = rebaseTargets[0];
  if (firstRebaseTarget != null) {
    const projectCount = new Set(rebaseTargets.map((target) => target.projectId)).size;
    const isSingleTarget = rebaseTargets.length === 1;
    const isSingleProject = projectCount === 1;
    suggestions.push({
      id: `rebase-project:${sessionId}`,
      kind: 'rebase-project',
      priority: 40,
      band: 2,
      title: isSingleTarget
        ? `Rebase ${firstRebaseTarget.projectName} on ${firstRebaseTarget.baseBranch}`
        : isSingleProject
          ? `Rebase ${firstRebaseTarget.projectName}`
          : `Rebase ${rebaseTargets.length} branches`,
      detail: isSingleTarget
        ? `${firstRebaseTarget.behind} behind`
        : isSingleProject
          ? `${rebaseTargets.length} branches behind`
          : `${projectCount} projects behind`,
      sessionId,
      targetKey: null,
      fingerprint: `rebase-project:${sessionId}:${rebaseTargets.map((target) => `${target.id}:${target.behind}`).join(',')}`,
      payload: { targets: rebaseTargets },
    });
  }
  const deduped = dedupeByTargetKey({ suggestions });
  const kept = applyDismissals({ suggestions: deduped, dismissedFingerprints });
  return sortNextSteps({ suggestions: kept, demotedKinds });
};
