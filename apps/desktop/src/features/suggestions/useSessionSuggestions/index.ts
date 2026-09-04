import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, PlanId, Session, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions, useSessionPlans } from '../../../store';
import { distanceBehind } from '../../../shared/lib/gitStatus';
import { workflowHasOpenQuestions } from '../../context/openQuestionsGate';
import { groupThreads } from '../../github/comment-threads';
import { splitWorkflowRuns } from '../../workflows/activeWorkflowRuns';
import { useAttachedWorkflowRuns } from '../../workflows/useAttachedWorkflowRuns';
import { useWorkflowAdvanceStates } from '../../workflows/useWorkflowAdvanceStates';
import { useResolverIndex } from '../../session/hooks/useResolverIndex';
import { useWorktreeStatuses } from '../../session/hooks/useWorktreeStatuses';
import { resolverForComment } from '../../session/resolver-linkage';
import { deriveSessionSuggestions } from '../deriveSessionSuggestions';

type Params = {
  readonly session: Session;
  readonly agents?: ReadonlyArray<Agent>;
  readonly withRebase?: boolean;
};

const NO_TARGETS: ReadonlyArray<{ readonly worktreePath: string; readonly baseBranch?: string }> =
  [];

export const useSessionSuggestions = ({ session, agents, withRebase = true }: Params) => {
  const sessionId = session.id;
  const storedAgents = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const effectiveAgents = agents ?? storedAgents;
  const plans = useSessionPlans(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const { active, agentsByRunId } = useMemo(
    () => splitWorkflowRuns({ attachedRuns, agents: effectiveAgents }),
    [attachedRuns, effectiveAgents],
  );
  const advanceByRunId = useWorkflowAdvanceStates({
    sessionId,
    workflows: active,
    agents: effectiveAgents,
  });
  const planConsumptions = useAppStore(
    useShallow((state) => plans.map((plan) => state.planConsumptions[plan.id] ?? EMPTY_ARRAY)),
  );
  const github = useAppStore((state) => state.sessionGithub[sessionId] ?? null);
  const pendingResolutions = useAppStore(
    (state) => state.sessionPendingResolutions[sessionId] ?? EMPTY_ARRAY,
  );
  const mounts = useAppStore(
    (state) =>
      state.sessionProjectMounts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter((project) => mounts.some((mount) => mount.projectId === project.id)),
    ),
  );
  const resolverIndex = useResolverIndex(sessionId);
  const targets = useMemo(
    () =>
      withRebase
        ? mounts.map((mount) => ({
            worktreePath: mount.worktreePath,
            baseBranch:
              projects.find((project) => project.id === mount.projectId)?.baseBranch ?? undefined,
          }))
        : NO_TARGETS,
    [mounts, projects, withRebase],
  );
  const worktreeStatuses = useWorktreeStatuses({ targets });

  return useMemo(() => {
    const pendingThreadIds = new Set(pendingResolutions.map((resolution) => resolution.threadId));
    const consumedPlanIds = new Set<PlanId>();
    for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
      const plan = plans[planIndex];
      if (plan == null) {
        continue;
      }
      const consumptionAgents = new Set(
        (planConsumptions[planIndex] ?? []).map((consumption) => consumption.agentId),
      );
      if (
        effectiveAgents.some(
          (agent) => agent.workflowRunId != null && consumptionAgents.has(agent.id),
        )
      ) {
        consumedPlanIds.add(plan.id);
      }
    }
    return deriveSessionSuggestions({
      sessionId,
      workflowRuns: active.map(({ run, workflow }) => {
        const advance = advanceByRunId.get(run.id);
        return {
          id: run.id,
          title: workflow.name,
          advanceState: {
            kind: advance?.kind ?? 'blocked',
            stepId: advance?.kind === 'ready' ? advance.step.id : undefined,
          },
          isRunning: (agentsByRunId.get(run.id) ?? []).some((agent) => agent.status === 'running'),
        };
      }),
      plans: plans.map((plan) => {
        const creator = effectiveAgents.find((agent) => agent.id === plan.agentId) ?? null;
        const workflow =
          creator?.stepId == null
            ? null
            : (attachedRuns.find(({ workflow: candidate }) =>
                candidate.steps.some((step) => step.id === creator.stepId),
              )?.workflow ?? null);
        return {
          id: plan.id,
          title: plan.title,
          status: plan.status,
          creatorHasOpenQuestions:
            workflow == null
              ? openQuestions.some((question) => question.status === 'open')
              : workflowHasOpenQuestions(openQuestions, workflow.id),
        };
      }),
      consumedPlanIds,
      openQuestionCount: openQuestions.filter((question) => question.status === 'open').length,
      hasPullRequest: github?.pr != null,
      threads: groupThreads(github?.detail?.comments ?? []).map((thread) => {
        const resolver = resolverForComment(resolverIndex, {
          threadId: thread.head.threadId,
          url: thread.head.url,
        });
        return {
          source: thread.head.source,
          resolved: thread.head.resolved === true,
          isPendingResolution:
            thread.head.threadId != null && pendingThreadIds.has(thread.head.threadId),
          resolverStatus: resolver?.status ?? null,
        };
      }),
      projects: withRebase
        ? mounts.map((mount) => {
            const project = projects.find((candidate) => candidate.id === mount.projectId) ?? null;
            const status = worktreeStatuses.get(mount.worktreePath) ?? null;
            return {
              projectId: mount.projectId,
              projectName: project?.name ?? mount.mountName,
              worktreePath: mount.worktreePath,
              baseBranch: project?.baseBranch ?? 'main',
              mainDistance:
                status == null ? null : distanceBehind({ distance: status.mainDistance }),
            };
          })
        : [],
    });
  }, [
    active,
    advanceByRunId,
    agentsByRunId,
    attachedRuns,
    effectiveAgents,
    github,
    mounts,
    openQuestions,
    pendingResolutions,
    planConsumptions,
    plans,
    projects,
    resolverIndex,
    sessionId,
    withRebase,
    worktreeStatuses,
  ]);
};
