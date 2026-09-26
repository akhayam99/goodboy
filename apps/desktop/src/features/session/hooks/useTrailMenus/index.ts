import { useMemo } from 'react';
import { LayoutDashboard, Plus, Square } from 'lucide-react';
import type {
  Agent,
  AgentId,
  ResolveAttempt,
  Session,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { sessionTitle } from '../../sessionTitle';
import type { CrumbMenuAction, CrumbMenuModel } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  agentPlace,
  useAppStore,
  useMountDiffStats,
  type LensKind,
} from '../../../../store';
import { resolveDiffMount } from '../../components/SessionWorkspace/parts/resolveDiffMount';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { useWorktreeStatuses } from '../useWorktreeStatuses';
import { branchMenu } from '../../trail/menus/branchMenu';
import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import {
  AGENT_KIND_PALETTE,
  KIND_TO_ROLE,
  ROLE_LABEL,
  agentHomeLens,
  classifyAgent,
  resolveRootAgent,
} from '../../agent-kind';
import { agentStateWord } from '../../agentStateWord';
import { useAgentLifecycleSignals } from '../useAgentLifecycleSignals';
import { settledResolverAgentIds } from '../../../review/settledResolverAgentIds';
import { selectResolverAgentIds } from '../../../review/selectResolverAgentIds';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { splitWorkflowRuns } from '../../../workflows/activeWorkflowRuns';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { useLensDestinations } from '../useLensDestinations';
import { usePageSummaries } from '../usePageSummaries';
import { useSelectedWorkflowRun } from '../useSelectedWorkflowRun';
import { openLens } from '../../openLens';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { pageMenu } from '../../trail/menus/pageMenu';
import { agentMenu } from '../../trail/menus/agentMenu';
import { stepMenu } from '../../trail/menus/stepMenu';
import { runMenu, type RunEntry } from '../../trail/menus/runMenu';
import { artifactEntryOf, artifactMenu } from '../../trail/menus/artifactMenu';

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export const createAgentEventName = (sessionId: SessionId): string =>
  `goodboy:open-create-agent:${sessionId}`;

type Params = {
  readonly session: Session;
  readonly crumbs: ReadonlyArray<BreadcrumbCrumb>;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
};

export const useTrailMenus = ({
  session,
  crumbs,
  activeLens,
  isBranchless,
}: Params): ReadonlyMap<string, CrumbMenuModel> => {
  const sessionId = session.id as SessionId;
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const kindOverride = useAppStore((s) => s.agentKindOverride);
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const focusedArtifactId = useAppStore((s) => s.focusedArtifactId[sessionId] ?? null);
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const resolveAttempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const navigate = useAppStore((s) => s.navigate);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setFocusedArtifactId = useAppStore((s) => s.setFocusedArtifactId);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const signals = useAgentLifecycleSignals({ sessionId });
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const selectedWorkflowRun = useSelectedWorkflowRun({ session });
  const destinations = useLensDestinations({ sessionId });
  const summaries = usePageSummaries({ session });
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const diffPath = useAppStore((s) =>
    resolveDiffMount({
      mounts: s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY,
      requestedPath: s.diffMountPath?.[sessionId] ?? null,
      fallbackPath: resolveSessionRepo({ state: s, sessionId })?.worktreePath ?? null,
    }),
  );
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const diffStats = useMountDiffStats(sessionId);
  const branchTargets = useMemo(
    () =>
      mounts.flatMap((mount) =>
        mount.worktreePath === '' || !mount.isAttached
          ? []
          : [{ worktreePath: mount.worktreePath, baseBranch: mount.baseBranch ?? undefined }],
      ),
    [mounts],
  );
  const branchStatuses = useWorktreeStatuses({ targets: branchTargets });

  return useMemo(() => {
    const menus = new Map<string, CrumbMenuModel>();
    const kindOf = (agent: Agent) =>
      classifyAgent({ agent, override: kindOverride[agent.id] ?? null });
    const settled = settledResolverAgentIds({ attempts: resolveAttempts });
    const activeParents = new Set(
      phaseRuns.flatMap((agent) =>
        agent.parentAgentId != null && (agent.status === 'pending' || agent.status === 'running')
          ? [agent.parentAgentId]
          : [],
      ),
    );
    const stateOf = (agent: Agent) =>
      agentStateWord({
        agent,
        hasOpenQuestion: signals.openQuestionAgentIds.has(agent.id),
        isTurnLive: signals.liveTurnAgentIds.has(agent.id),
        hasActiveChild: activeParents.has(agent.id),
        isResolverSettled: settled.has(agent.id),
      });
    const roleOf = (agent: Agent) => {
      const kind = kindOf(agent);
      return { label: ROLE_LABEL[KIND_TO_ROLE[kind]], tone: AGENT_KIND_PALETTE[kind].fg };
    };
    const toAgent = (agentId: AgentId) => navigate({ to: agentPlace({ sessionId, agentId }) });
    const startWorkflow: CrumbMenuAction = {
      id: 'start-workflow',
      label: 'Start a workflow',
      icon: Plus,
      confirm: null,
      onRun: () =>
        window.dispatchEvent(
          new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
        ),
    };
    const startAgent: CrumbMenuAction = {
      id: 'start-agent',
      label: 'Start agent',
      icon: Plus,
      confirm: null,
      onRun: () => {
        openLens({ sessionId, lens: 'agents' });
        window.requestAnimationFrame(() =>
          window.dispatchEvent(new CustomEvent(createAgentEventName(sessionId))),
        );
      },
    };
    const stopAction = (agent: Agent): ReadonlyArray<CrumbMenuAction> =>
      agent.status === 'running' || signals.liveTurnAgentIds.has(agent.id)
        ? [
            {
              id: 'stop',
              label: 'Stop this step',
              icon: Square,
              confirm: {
                title: `Stop ${agent.name}?`,
                description:
                  'The edits it made so far stay in the branch. Later steps wait for you.',
                confirmLabel: 'Stop step',
              },
              onRun: () => void cancelCurrentTurn(sessionId, agent.id, 'user'),
            },
          ]
        : [];
    const resolvers = selectResolverAgentIds({ agents: phaseRuns, kindOverride });

    const menuForAgent = (agent: Agent): CrumbMenuModel | null => {
      if (agent.parentAgentId == null && agent.workflowRunId != null && agent.stepId != null) {
        const entry = attachedRuns.find(({ run }) => run.id === agent.workflowRunId) ?? null;
        if (entry === null) {
          return null;
        }
        return stepMenu({
          workflow: entry.workflow,
          runId: entry.run.id,
          runTitle: entry.run.title ?? workflowKindName(entry.workflow),
          agents: phaseRuns,
          currentAgentId: agent.id,
          stateOf,
          roleLabelOf: (stepAgent, role) => (stepAgent !== null ? roleOf(stepAgent).label : role),
          modelOf: (stepAgent, stepModel) => stepAgent?.modelOverride ?? stepModel ?? 'Auto',
          actions: stopAction(agent),
          onSelect: toAgent,
        });
      }
      if (resolvers.has(agent.id)) {
        return null;
      }
      const kind = kindOf(agent);
      const peers =
        agent.parentAgentId != null
          ? phaseRuns.filter(
              (candidate) =>
                candidate.parentAgentId === agent.parentAgentId &&
                (kindOf(candidate) === kind || candidate.id === agent.id),
            )
          : phaseRuns.filter(
              (candidate) =>
                candidate.parentAgentId == null &&
                candidate.workflowRunId == null &&
                !resolvers.has(candidate.id) &&
                agentHomeLens({ agent: candidate, kind: kindOf(candidate) }) ===
                  agentHomeLens({ agent, kind }),
            );
      return agentMenu({
        peers,
        currentAgentId: agent.id,
        stateOf,
        roleOf,
        modelOf: (peer) => peer.modelOverride ?? null,
        actions: agent.parentAgentId == null ? [startAgent] : [],
        onSelect: toAgent,
      });
    };

    const selected = phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null;
    const parent =
      selected?.parentAgentId == null
        ? null
        : (phaseRuns.find((agent) => agent.id === selected.parentAgentId) ?? null);
    const root =
      parent?.parentAgentId == null
        ? null
        : resolveRootAgent({ agents: phaseRuns, agentId: parent.id });
    const { completed, discarded } = splitWorkflowRuns({ attachedRuns, agents: phaseRuns });
    const finishedIds = new Set([...completed, ...discarded].map(({ run }) => run.id));
    const runEntries: ReadonlyArray<RunEntry> = attachedRuns.map((entry) => ({
      ...entry,
      isFinished: finishedIds.has(entry.run.id),
    }));
    const pageActions: Partial<Record<LensKind, ReadonlyArray<CrumbMenuAction>>> = {
      agents: [startAgent],
      workflows: [startWorkflow],
    };

    crumbs.forEach((crumb, index) => {
      const isDepthOne = crumbs.length === 1 ? index === 0 : index === 1;
      if (isDepthOne) {
        menus.set(
          crumb.id,
          pageMenu({
            destinations,
            activeLens,
            isBranchless,
            sessionTitle: sessionTitle({ session }),
            summaries,
            actions: activeLens === null ? [] : (pageActions[activeLens] ?? []),
            onSelect: (lens) => {
              setFocusedArtifactId(sessionId, null);
              setFocusedWorkflowRun(sessionId, null);
              openLens({ sessionId, lens });
            },
          }),
        );
        return;
      }
      if (crumb.id === 'workflow-run' && runEntries.length > 0) {
        menus.set(
          crumb.id,
          runMenu({
            runs: runEntries,
            agents: phaseRuns,
            currentRunId:
              selectedWorkflowRun?.run.id ?? (focusedWorkflowRunId as WorkflowRunId | null),
            nameOf: (entry) => entry.run.title ?? workflowKindName(entry.workflow),
            actions: [startWorkflow],
            onSelect: (runId) => {
              setFocusedWorkflowRun(sessionId, runId);
              openLens({ sessionId, lens: 'workflows' });
            },
          }),
        );
        return;
      }
      if (crumb.id === 'diff-branch') {
        menus.set(
          crumb.id,
          branchMenu({
            mounts,
            currentPath: diffPath,
            statOf: (mount) => diffStats.get(mount.worktreePath) ?? null,
            statusOf: (mount) => branchStatuses.get(mount.worktreePath) ?? null,
            actions: [
              {
                id: 'all-branches',
                label: 'All branches in Overview',
                icon: LayoutDashboard,
                confirm: null,
                onRun: () => openLens({ sessionId, lens: null }),
              },
            ],
            onSelect: (mount) => openMountDiff(sessionId, mount.worktreePath),
          }),
        );
        return;
      }
      if (crumb.id === 'artifact' && artifacts.length > 0) {
        const nowMs = Date.now();
        menus.set(
          crumb.id,
          artifactMenu({
            artifacts: artifacts
              .filter((artifact) => artifact.status !== 'discarded')
              .map((artifact) =>
                artifactEntryOf({
                  artifact,
                  author: (() => {
                    const author = phaseRuns.find((agent) => agent.id === artifact.agentId);
                    return author === undefined ? null : roleOf(author).label;
                  })(),
                }),
              ),
            currentId: focusedArtifactId,
            ageOf: (iso) => formatRelativeAge({ fromIso: iso, nowMs }),
            onSelect: (id) => {
              setFocusedArtifactId(sessionId, id);
              openLens({ sessionId, lens: 'plans' });
            },
          }),
        );
        return;
      }
      const agent =
        crumb.id === 'selected-child'
          ? selected
          : crumb.id === 'selected-parent'
            ? parent
            : crumb.id === 'selected-root'
              ? root
              : null;
      if (agent === null) {
        return;
      }
      const menu = menuForAgent(agent);
      if (menu !== null) {
        menus.set(crumb.id, menu);
      }
    });
    return menus;
  }, [
    crumbs,
    phaseRuns,
    kindOverride,
    resolveAttempts,
    signals,
    selectedAgentId,
    attachedRuns,
    selectedWorkflowRun,
    focusedWorkflowRunId,
    focusedArtifactId,
    artifacts,
    destinations,
    summaries,
    activeLens,
    isBranchless,
    session,
    sessionId,
    navigate,
    setFocusedArtifactId,
    setFocusedWorkflowRun,
    cancelCurrentTurn,
    mounts,
    diffPath,
    diffStats,
    branchStatuses,
    openMountDiff,
  ]);
};
