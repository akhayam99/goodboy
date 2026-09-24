import { useMemo } from 'react';
import type { Agent, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
  useSessionPlans,
  type LensKind,
} from '../../../../store';
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
import { resolveRootAgent } from '../../agent-kind';
import { useSelectedWorkflowRun } from '../useSelectedWorkflowRun';
import { useSelectedAgentHome } from '../useSelectedAgentHome';

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
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
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
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const selectAgent = useAppStore((s) => s.selectAgent);

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

  const selectedParentLabel = parentAgent?.name ?? null;
  const selectedRootLabel =
    rootAgent != null && parentAgent != null && rootAgent.id !== parentAgent.id
      ? rootAgent.name
      : null;
  const parentAgentId = parentAgent?.id ?? null;
  const rootAgentId = rootAgent?.id ?? null;

  const focusedWorkflowName = useMemo(() => {
    const focusedRun = attachedWorkflowRuns.find(({ run }) => run.id === focusedWorkflowRunId);
    return focusedRun == null ? null : workflowKindName(focusedRun.workflow);
  }, [focusedWorkflowRunId, attachedWorkflowRuns]);

  const focusedPlanTitle = useMemo(
    () => plans.find((p) => p.id === focusedPlanId)?.title ?? null,
    [plans, focusedPlanId],
  );

  const artifactCreationLabel =
    artifactCreationKind === null
      ? null
      : ARTIFACT_CREATION_ADAPTERS[artifactCreationKind].crumbLabel;

  const selectedChildWorkflowName =
    selectedWorkflowRun == null ? null : workflowKindName(selectedWorkflowRun.workflow);
  const selectedWorkflowRunId = selectedWorkflowRun?.run.id ?? null;

  return useMemo(
    () =>
      buildSessionBreadcrumb({
        lens,
        studio,
        focusedWorkflowName,
        selectedChildWorkflowName,
        focusedPlanTitle,
        artifactCreationLabel,
        selectedChildLabel,
        selectedChildHome,
        selectedParentLabel,
        selectedRootLabel,
        selectedQuestionLabel,
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
          toPlansList: () => {
            setFocusedPlanId(sessionId, null);
            openLens({ sessionId, lens: 'plans' });
          },
          toParentAgent: () => {
            if (parentAgentId == null) {
              return;
            }
            void selectAgent(sessionId, parentAgentId);
          },
          toRootAgent: () => {
            if (rootAgentId == null) {
              return;
            }
            void selectAgent(sessionId, rootAgentId);
          },
        },
      }),
    [
      lens,
      studio,
      focusedWorkflowName,
      selectedChildWorkflowName,
      selectedWorkflowRunId,
      focusedPlanTitle,
      artifactCreationLabel,
      selectedChildLabel,
      selectedChildHome,
      selectedParentLabel,
      selectedRootLabel,
      selectedQuestionLabel,
      parentAgentId,
      rootAgentId,
      isBranchless,
      sessionId,
      setFocusedWorkflowRun,
      setFocusedPlanId,
      selectAgent,
    ],
  );
};
