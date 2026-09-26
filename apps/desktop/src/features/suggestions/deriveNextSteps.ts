import type { MountId, PlanId, ProjectId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';
import {
  pendingMountEvents,
  type SuggestionMountEvent,
} from '../../store/materializationProposals';
import { applyDismissals, dedupeByTargetKey, sortNextSteps } from './nextStepGates';
import type { RebaseSuggestionTarget, SessionSuggestion, SuggestionKind } from './types';

export type SuggestionWorkflowRun = {
  readonly id: WorkflowRunId;
  readonly title: string;
  readonly advanceState: { readonly kind: string; readonly stepId?: StepId };
  readonly isRunning: boolean;
};

export type SuggestionPlan = {
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

export type SuggestionProject = {
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

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRuns: ReadonlyArray<SuggestionWorkflowRun>;
  readonly plans: ReadonlyArray<SuggestionPlan>;
  readonly consumedPlanIds: ReadonlySet<PlanId>;
  readonly openQuestionCount: number;
  readonly hasPullRequest: boolean;
  readonly eligibleThreadCount: number;
  readonly projects: ReadonlyArray<SuggestionProject>;
  readonly mountEvents: ReadonlyArray<SuggestionMountEvent>;
  readonly dismissedFingerprints?: ReadonlySet<string>;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
};

export const deriveNextSteps = ({
  sessionId,
  workflowRuns,
  plans,
  consumedPlanIds,
  openQuestionCount,
  hasPullRequest,
  eligibleThreadCount,
  projects,
  mountEvents,
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
      payload: { count: openQuestionCount },
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
