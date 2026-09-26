import { useMemo } from 'react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
  useSessionPlans,
  type LensKind,
  agentPlace,
  sessionPlace,
} from '../../../../store';
import { resolverThread } from '../../../../store/slices/navigation/resolverThread';
import { useResolveQueueRows } from '../../../resolve/hooks/useResolveQueueRows';
import { threadLocationOf } from '../../../resolve/threadLocationOf';
import { clipQuestionText, isQuestionDelegate } from '../../../context/questionDelegate';
import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import { useIsBranchlessSession } from '../useIsBranchlessSession';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { ARTIFACT_CREATION_ADAPTERS } from '../../../artifacts/artifactCreationAdapters';
import { buildSessionBreadcrumb } from '../../components/SessionWorkspace/sessionBreadcrumb';
import { lensLabelFor } from '../../lens-labels';
import { supportedLens } from '../../supportedLens';
import { openLens } from '../../openLens';
import { AGENT_KIND_PALETTE, classifyAgent, resolveRootAgent } from '../../agent-kind';
import { useSelectedWorkflowRun } from '../useSelectedWorkflowRun';
import { useSelectedAgentHome } from '../useSelectedAgentHome';
import { REVIEW_MODE_LABEL } from '../../../review/reviewModeLabel';
import { focusedArtifactTitleOf } from '../../../artifacts/focusedArtifactTitleOf';
import { resolveDiffMount } from '../../components/SessionWorkspace/parts/resolveDiffMount';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';

type Params = {
  readonly session: Session;
};

export const useSessionCrumbs = ({ session }: Params): ReadonlyArray<BreadcrumbCrumb> => {
  const sessionId = session.id as SessionId;
  const isBranchless = useIsBranchlessSession({ session });
  const storedActiveLens = useAppStore((s) => s.activeLens[sessionId] ?? null);
  const lens = supportedLens({ lens: storedActiveLens, isBranchless });
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const focusedArtifactId = useAppStore((s) => s.focusedArtifactId[sessionId] ?? null);
  const artifactCreationKind = useAppStore((s) => s.artifactCreation[sessionId]?.kind ?? null);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const selectedChildHome = useSelectedAgentHome(sessionId);
  const attachedWorkflowRuns = useAttachedWorkflowRuns({ session });
  const selectedWorkflowRun = useSelectedWorkflowRun({ session });
  const plans = useSessionPlans(sessionId);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setFocusedArtifactId = useAppStore((s) => s.setFocusedArtifactId);
  const navigate = useAppStore((s) => s.navigate);
  const reviewMode = useAppStore((s) => s.reviewModes[sessionId] ?? 'queue');
  const setReviewMode = useAppStore((s) => s.setReviewMode);
  const reviewModeLabel = REVIEW_MODE_LABEL[reviewMode];
  const resolverThreadId = useAppStore((s) =>
    selectedAgentId == null || selectedChildHome !== 'review'
      ? null
      : resolverThread({ state: s, sessionId, agentId: selectedAgentId as AgentId }),
  );
  const queueRows = useResolveQueueRows({ sessionId });
  const selectedThreadLabel = useMemo(() => {
    if (resolverThreadId === null) {
      return null;
    }
    const row = queueRows.find((candidate) => candidate.thread.threadId === resolverThreadId);
    return row === undefined ? 'Comment' : (threadLocationOf({ row })?.shortLabel ?? 'Comment');
  }, [queueRows, resolverThreadId]);
  const diffBranchLabel = useAppStore((s) => {
    const mounts = s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY;
    const path = resolveDiffMount({
      mounts,
      requestedPath: s.diffMountPath?.[sessionId] ?? null,
      fallbackPath: resolveSessionRepo({ state: s, sessionId })?.worktreePath ?? null,
    });
    const mount = mounts.find((candidate) => candidate.worktreePath === path) ?? null;
    if (mount === null) {
      return null;
    }
    return mount.branch === '' ? mount.mountName : `${mount.mountName} ${mount.branch}`;
  });

  const selectedAgent = useMemo(
    () => phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null,
    [phaseRuns, selectedAgentId],
  );
  const selectedChildLabel = selectedAgent?.name ?? null;

  const parentAgent = useMemo(() => {
    const parentId = selectedAgent?.parentAgentId ?? null;
    if (parentId == null) {
      return null;
    }
    return phaseRuns.find((agent) => agent.id === parentId) ?? null;
  }, [phaseRuns, selectedAgent]);

  const rootAgent = useMemo(() => {
    if (parentAgent == null || parentAgent.parentAgentId == null) {
      return null;
    }
    return resolveRootAgent({ agents: phaseRuns, agentId: parentAgent.id });
  }, [phaseRuns, parentAgent]);

  const openQuestions = useSessionOpenQuestions(sessionId);
  const answeredQuestions = useSessionAnsweredQuestions(sessionId);
  const selectedQuestionLabel = useMemo(() => {
    if (selectedAgent == null || !isQuestionDelegate({ agent: selectedAgent })) {
      return null;
    }
    const question =
      [...openQuestions, ...answeredQuestions].find(
        (candidate) => candidate.id === selectedAgent.sourceThreadId,
      ) ?? null;
    return question === null ? null : clipQuestionText({ text: question.text });
  }, [answeredQuestions, openQuestions, selectedAgent]);

  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const toneOf = (agent: Agent | null): string | null =>
    agent == null
      ? null
      : AGENT_KIND_PALETTE[classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null })]
          .fg;
  const selectedChildTone = toneOf(selectedAgent);
  const selectedParentTone = toneOf(parentAgent);
  const selectedRootTone = toneOf(rootAgent);

  const selectedParentLabel = parentAgent?.name ?? null;
  const selectedRootLabel =
    rootAgent != null && parentAgent != null && rootAgent.id !== parentAgent.id
      ? rootAgent.name
      : null;
  const parentAgentId = parentAgent?.id ?? null;
  const rootAgentId = rootAgent?.id ?? null;

  const focusedWorkflowName = useMemo(() => {
    const focusedRun = attachedWorkflowRuns.find(({ run }) => run.id === focusedWorkflowRunId);
    return focusedRun == null
      ? null
      : (focusedRun.run.title ?? workflowKindName(focusedRun.workflow));
  }, [focusedWorkflowRunId, attachedWorkflowRuns]);

  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const focusedArtifactTitle = useMemo(
    () => focusedArtifactTitleOf({ plans, artifacts, artifactId: focusedArtifactId }),
    [plans, artifacts, focusedArtifactId],
  );

  const artifactCreationLabel =
    artifactCreationKind === null
      ? null
      : ARTIFACT_CREATION_ADAPTERS[artifactCreationKind].crumbLabel;

  const selectedChildWorkflowName =
    selectedWorkflowRun == null
      ? null
      : (selectedWorkflowRun.run.title ?? workflowKindName(selectedWorkflowRun.workflow));
  const selectedWorkflowRunId = selectedWorkflowRun?.run.id ?? null;

  return useMemo(
    () =>
      buildSessionBreadcrumb({
        lens,
        studio,
        focusedWorkflowName,
        selectedChildWorkflowName,
        focusedArtifactTitle,
        artifactCreationLabel,
        selectedChildLabel,
        selectedChildHome,
        selectedParentLabel,
        selectedRootLabel,
        selectedChildTone,
        selectedParentTone,
        selectedRootTone,
        selectedQuestionLabel,
        reviewModeLabel,
        diffBranchLabel,
        selectedThreadLabel,
        lensLabel: (kind: LensKind) => lensLabelFor({ lens: kind, isBranchless }),
        handlers: {
          toOverview: () => openLens({ sessionId, lens: null }),
          toLens: (l) => openLens({ sessionId, lens: l }),
          toWorkflowsList: () => {
            setFocusedWorkflowRun(sessionId, null);
            openLens({ sessionId, lens: 'workflows' });
          },
          toWorkflowRun: () => {
            if (selectedWorkflowRunId == null) {
              return;
            }
            setFocusedWorkflowRun(sessionId, selectedWorkflowRunId);
            openLens({ sessionId, lens: 'workflows' });
          },
          toArtifactsList: () => {
            setFocusedArtifactId(sessionId, null);
            openLens({ sessionId, lens: 'plans' });
          },
          toParentAgent: () => {
            if (parentAgentId == null) {
              return;
            }
            navigate({ to: agentPlace({ sessionId, agentId: parentAgentId }) });
          },
          toRootAgent: () => {
            if (rootAgentId == null) {
              return;
            }
            navigate({ to: agentPlace({ sessionId, agentId: rootAgentId }) });
          },
          toReviewHome: () => setReviewMode({ sessionId, mode: 'queue' }),
          toThread: () => {
            if (resolverThreadId === null) {
              return;
            }
            navigate({
              to: sessionPlace({ sessionId, lens: 'review' }),
              drawer: {
                kind: 'conversation',
                sessionId,
                payload: { threadId: resolverThreadId, tab: 'comment' },
              },
            });
          },
        },
      }),
    [
      lens,
      studio,
      focusedWorkflowName,
      selectedChildWorkflowName,
      selectedWorkflowRunId,
      focusedArtifactTitle,
      artifactCreationLabel,
      selectedChildLabel,
      selectedChildHome,
      selectedParentLabel,
      selectedRootLabel,
      selectedChildTone,
      selectedParentTone,
      selectedRootTone,
      selectedQuestionLabel,
      reviewModeLabel,
      diffBranchLabel,
      selectedThreadLabel,
      resolverThreadId,
      parentAgentId,
      rootAgentId,
      isBranchless,
      sessionId,
      setFocusedWorkflowRun,
      setFocusedArtifactId,
      navigate,
      setReviewMode,
    ],
  );
};
