import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, PlanId, Session, SessionEvent, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions, useSessionPlans } from '../../../store';
import { isMountCompleted } from '../../../store/slices/project-mounts/mountRowModel';
import { distanceAhead, distanceBehind, isWorkingTreeClean } from '../../../shared/lib/gitStatus';
import { workflowHasOpenQuestions } from '../../context/openQuestionsGate';
import { splitWorkflowRuns } from '../../workflows/activeWorkflowRuns';
import { useAttachedWorkflowRuns } from '../../workflows/useAttachedWorkflowRuns';
import { useWorkflowAdvanceStates } from '../../workflows/useWorkflowAdvanceStates';
import { useWorktreeStatuses } from '../../session/hooks/useWorktreeStatuses';
import { AGENT_KIND_META, classifyAgent } from '../../session/agent-kind';
import {
  deriveNextSteps,
  type SuggestionAgent,
  type SuggestionRebaseRequest,
} from '../deriveNextSteps';
import { eligibleReviewThreadCount } from '../eligibleThreads';
import { toMountEvents } from '../../../store/materializationProposals';
import { pendingAgentSignal } from '../pendingAgentSignal';
import { useNextStepOutcomes } from '../useNextStepOutcomes';
import { shouldDemote } from '../nextStepGates';
import { SUGGESTION_KINDS, type SuggestionKind } from '../types';

type Params = {
  readonly session: Session;
  readonly agents?: ReadonlyArray<Agent>;
  readonly withRebase?: boolean;
};

type LatestRebaseRequestsParams = {
  readonly events: ReadonlyArray<SessionEvent>;
  readonly agents: ReadonlyArray<Agent>;
};

type RebaseRequestKeyParams = {
  readonly mountId: string | null;
  readonly projectId: string;
};

type RebaseTargetIdParams = {
  readonly mountId: string;
};

const NO_TARGETS: ReadonlyArray<{ readonly worktreePath: string; readonly baseBranch?: string }> =
  [];

const rebaseRequestKey = ({ mountId, projectId }: RebaseRequestKeyParams): string =>
  mountId == null ? `project:${projectId}` : `mount:${mountId}`;

const rebaseTargetId = ({ mountId }: RebaseTargetIdParams): string => `mount:${mountId}`;

const latestRebaseRequests = ({
  events,
  agents,
}: LatestRebaseRequestsParams): ReadonlyMap<string, SuggestionRebaseRequest> => {
  const requests = new Map<string, SuggestionRebaseRequest>();
  const agentsById = new Map<string, Agent>(agents.map((agent) => [agent.id, agent]));
  for (const event of events) {
    const projectId = event.payload?.projectId;
    if (event.kind !== 'rebase_requested' || projectId == null) {
      continue;
    }
    const agentId = event.payload?.agentId ?? null;
    const agent = agentId == null ? null : (agentsById.get(agentId) ?? null);
    requests.set(rebaseRequestKey({ mountId: event.payload?.mountId ?? null, projectId }), {
      behind: event.payload?.behind ?? null,
      baseBranch: event.payload?.branch ?? null,
      agentStatus: agent?.status ?? null,
    });
  }
  return requests;
};

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
  const resolveRows = useAppStore((state) => state.sessionResolveThreads[sessionId] ?? EMPTY_ARRAY);
  const mounts = useAppStore(
    (state) =>
      state.sessionProjectMounts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const recommendedWorkflow = useAppStore(
    useShallow((state) => {
      const templates = state.phaseTemplates[session.workspaceId] ?? EMPTY_ARRAY;
      const library = templates.find((template) => template.origin === 'library');
      return library == null ? null : { id: library.id, name: library.name };
    }),
  );
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const blockedAgentIds = useAppStore(
    useShallow((state) =>
      effectiveAgents
        .filter((agent) => state.agentTurnState[agent.id]?.kind === 'blocked')
        .map((agent) => agent.id),
    ),
  );
  const blockedTranscripts = useAppStore(
    useShallow((state) =>
      Object.fromEntries(
        blockedAgentIds.map((agentId) => [agentId, state.transcripts[agentId] ?? EMPTY_ARRAY]),
      ),
    ),
  );
  const mountGithubByMountId = useAppStore(
    useShallow((state) =>
      Object.fromEntries(
        mounts.map((mount) => [mount.mountId, state.mountGithub[mount.mountId] ?? null]),
      ),
    ),
  );
  const cleanupProposals = useAppStore(
    (state) => state.mountCleanupProposals[sessionId] ?? EMPTY_ARRAY,
  );
  const completedMountIds = useAppStore(
    useShallow((state) =>
      mounts.flatMap((mount) =>
        isMountCompleted({ state, mountId: mount.mountId }) ? [mount.mountId] : [],
      ),
    ),
  );
  const rebaseMounts = useMemo(
    () => mounts.filter((mount) => !completedMountIds.includes(mount.mountId)),
    [completedMountIds, mounts],
  );
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter((project) => mounts.some((mount) => mount.projectId === project.id)),
    ),
  );
  const events = useAppStore(
    (state) => state.sessionEvents?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionEvent>),
  );
  const targets = useMemo(
    () =>
      withRebase
        ? rebaseMounts.map((mount) => ({
            worktreePath: mount.worktreePath,
            baseBranch:
              mount.baseBranch ??
              projects.find((project) => project.id === mount.projectId)?.baseBranch ??
              undefined,
          }))
        : NO_TARGETS,
    [projects, rebaseMounts, withRebase],
  );
  const worktreeStatuses = useWorktreeStatuses({ targets });
  const { outcomes, dismissedFingerprints } = useNextStepOutcomes({ sessionId });
  const demotedKinds = useMemo(() => {
    const now = () => Date.now();
    const demoted = new Set<SuggestionKind>();
    for (const kind of SUGGESTION_KINDS) {
      if (shouldDemote({ kind, outcomes, now })) {
        demoted.add(kind);
      }
    }
    return demoted;
  }, [outcomes]);

  return useMemo(() => {
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
    const rebaseRequests = latestRebaseRequests({ events, agents: effectiveAgents });
    return deriveNextSteps({
      sessionId,
      workflowRuns: active.map(({ run, workflow }) => {
        const advance = advanceByRunId.get(run.id);
        return {
          id: run.id,
          title: run.title ?? workflow.name,
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
              : workflowHasOpenQuestions({ questions: openQuestions, workflowId: workflow.id }),
        };
      }),
      consumedPlanIds,
      openQuestionCount: openQuestions.filter((question) => question.status === 'open').length,
      hasPullRequest: github?.pr != null,
      eligibleThreadCount: eligibleReviewThreadCount({ github, rows: resolveRows }),
      mountEvents: toMountEvents({ events }),
      projects: withRebase
        ? rebaseMounts.map((mount) => {
            const project = projects.find((candidate) => candidate.id === mount.projectId) ?? null;
            const status = worktreeStatuses.get(mount.worktreePath) ?? null;
            const mountId = mount.mountId;
            const mountRequest = rebaseRequests.get(
              rebaseRequestKey({ mountId, projectId: mount.projectId }),
            );
            const projectRequest = rebaseRequests.get(
              rebaseRequestKey({ mountId: null, projectId: mount.projectId }),
            );
            return {
              id: rebaseTargetId({ mountId }),
              mountId,
              projectId: mount.projectId,
              projectName: project?.name ?? mount.mountName,
              branch: mount.branch,
              worktreePath: mount.worktreePath,
              baseBranch: mount.baseBranch ?? project?.baseBranch ?? 'main',
              mainDistance:
                status == null ? null : distanceBehind({ distance: status.mainDistance }),
              rebaseRequest: mountRequest ?? projectRequest ?? null,
            };
          })
        : [],
      agents: effectiveAgents.map((agent) => {
        const kind = classifyAgent({
          agent: { kind: agent.kind, name: agent.name ?? agent.id },
          override: agentKindOverride[agent.id] ?? null,
        });
        return {
          id: agent.id,
          label: AGENT_KIND_META[kind].noun,
          roleKind: kind,
          status: agent.status,
          workflowRunId: agent.workflowRunId ?? null,
          ordinal: agent.ordinal,
          pendingSignal: pendingAgentSignal({
            events: blockedTranscripts[agent.id] ?? EMPTY_ARRAY,
          }),
        };
      }) satisfies ReadonlyArray<SuggestionAgent>,
      mounts: withRebase
        ? rebaseMounts.map((mount) => {
            const project = projects.find((candidate) => candidate.id === mount.projectId) ?? null;
            const status = worktreeStatuses.get(mount.worktreePath) ?? null;
            const githubState = mountGithubByMountId[mount.mountId] ?? null;
            return {
              mountId: mount.mountId,
              projectId: mount.projectId,
              projectName: project?.name ?? mount.mountName,
              branch: mount.branch,
              worktreePath: mount.worktreePath,
              aheadOfUpstream:
                status == null ? null : distanceAhead({ distance: status.upstreamDistance }),
              aheadOfBase: status == null ? null : distanceAhead({ distance: status.mainDistance }),
              isClean:
                status == null ? null : isWorkingTreeClean({ workingTree: status.workingTree }),
              pr: githubState?.pr ?? null,
              fetchedAt: githubState?.fetchedAt ?? null,
            };
          })
        : [],
      cleanupProposals: cleanupProposals.flatMap((proposal) => {
        if (proposal.request === null) {
          return [];
        }
        const project = projects.find((candidate) => candidate.id === proposal.projectId) ?? null;
        return [
          {
            requestId: proposal.requestId,
            mountId: proposal.mountId,
            projectName: project?.name ?? proposal.branch,
            branch: proposal.branch,
            prNumber: proposal.request.prNumber,
          },
        ];
      }),
      hasRunningAgent: effectiveAgents.some((agent) => agent.status === 'running'),
      hasGoal: session.goal.trim() !== '',
      recommendedWorkflow,
      dismissedFingerprints,
      demotedKinds,
    });
  }, [
    dismissedFingerprints,
    active,
    advanceByRunId,
    agentKindOverride,
    agentsByRunId,
    attachedRuns,
    blockedTranscripts,
    cleanupProposals,
    demotedKinds,
    effectiveAgents,
    events,
    github,
    mountGithubByMountId,
    openQuestions,
    recommendedWorkflow,
    session.goal,
    planConsumptions,
    plans,
    projects,
    rebaseMounts,
    resolveRows,
    sessionId,
    withRebase,
    worktreeStatuses,
  ]);
};
