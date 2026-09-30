import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, ResolveAttempt, Session, SessionId } from '@goodboy/types';
import { useCopyLink } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useMountDiffStats } from '../../../../../store';
import { resolveDiffMount } from '../../../components/SessionWorkspace/parts/resolveDiffMount';
import { resolveSessionRepo } from '../../../../../store/slices/worktrees/resolveSessionRepo';
import { isMountRequestMerged } from '../../../../../store/slices/project-mounts/mountRowModel';
import { selectActiveProjectPrs } from '../../../../../store/slices/github/activeProjectPrs';
import { resolverThread } from '../../../../../store/slices/navigation/resolverThread';
import { useResolveQueueRows } from '../../../../resolve/hooks/useResolveQueueRows';
import { useResolveAgain } from '../../../../resolve/hooks/useResolveAgain';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { useAgentLifecycleSignals } from '../../useAgentLifecycleSignals';
import { useLensDestinations } from '../../useLensDestinations';
import { usePageSummaries } from '../../usePageSummaries';
import { useSelectedWorkflowRun } from '../../useSelectedWorkflowRun';
import { useWorktreeStatuses } from '../../useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../useWorktreeStatuses/targets';
import type { TrailMenuInputs } from '../trailMenuInputs';

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

type Params = {
  readonly session: Session;
};

export const useTrailMenuInputs = ({ session }: Params): TrailMenuInputs => {
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
  const recoverStuckStep = useAppStore((s) => s.recoverStuckStep);
  const reportError = useAppStore((s) => s.reportError);
  const workspaceSlug = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === session.workspaceId)?.slug ?? null,
  );
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
  const mergedMountIds = useAppStore(
    useShallow((s) =>
      (s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY).flatMap((mount) =>
        isMountRequestMerged({ state: s, mountId: mount.mountId }) ? [mount.mountId] : [],
      ),
    ),
  );
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const diffStats = useMountDiffStats(sessionId);
  const projects = useAppStore((s) => s.projects);
  const branchTargets = useMemo(
    () => worktreeStatusTargetsOf({ mounts, projects }),
    [mounts, projects],
  );
  const branchStatuses = useWorktreeStatuses({ targets: branchTargets });
  const queueRows = useResolveQueueRows({ sessionId });
  const resolveAgain = useResolveAgain({ sessionId, rows: queueRows });
  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber?.[sessionId] ?? null);
  const branchPrs = useAppStore((s) => selectActiveProjectPrs({ state: s, sessionId }));
  const canonicalPr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const pullRequests = useMemo(
    () => (branchPrs.length > 0 ? branchPrs : canonicalPr === null ? [] : [canonicalPr]),
    [branchPrs, canonicalPr],
  );
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const threadId = useAppStore((s) =>
    selectedAgentId === null
      ? null
      : resolverThread({ state: s, sessionId, agentId: selectedAgentId }),
  );
  const { copy } = useCopyLink();

  return useMemo(
    () => ({
      session,
      sessionId,
      selectedAgentId,
      phaseRuns,
      kindOverride,
      focusedWorkflowRunId,
      focusedArtifactId,
      artifacts,
      resolveAttempts,
      navigate,
      setFocusedWorkflowRun,
      setFocusedArtifactId,
      cancelCurrentTurn,
      recoverStuckStep,
      reportError,
      workspaceSlug,
      signals,
      attachedRuns,
      selectedWorkflowRun,
      destinations,
      summaries,
      mounts,
      diffPath,
      diffStats,
      branchStatuses,
      mergedMountIds,
      openMountDiff,
      queueRows,
      resolveAgain,
      prNumber,
      selectedPrNumber,
      pullRequests,
      selectSessionPr,
      setPullRequestMode,
      threadId,
      copy,
    }),
    [
      session,
      sessionId,
      selectedAgentId,
      phaseRuns,
      kindOverride,
      focusedWorkflowRunId,
      focusedArtifactId,
      artifacts,
      resolveAttempts,
      navigate,
      setFocusedWorkflowRun,
      setFocusedArtifactId,
      cancelCurrentTurn,
      recoverStuckStep,
      reportError,
      workspaceSlug,
      signals,
      attachedRuns,
      selectedWorkflowRun,
      destinations,
      summaries,
      mounts,
      diffPath,
      diffStats,
      branchStatuses,
      mergedMountIds,
      openMountDiff,
      queueRows,
      resolveAgain,
      prNumber,
      selectedPrNumber,
      pullRequests,
      selectSessionPr,
      setPullRequestMode,
      threadId,
      copy,
    ],
  );
};
