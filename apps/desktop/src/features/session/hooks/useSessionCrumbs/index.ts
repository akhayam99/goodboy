import { useMemo } from 'react';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans, type LensKind } from '../../../../store';
import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { useIsBranchlessSession } from '../useIsBranchlessSession';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { buildSessionBreadcrumb } from '../../components/SessionWorkspace/sessionBreadcrumb';
import { SIMPLE_LENSES, lensLabelFor } from '../../lens-labels';
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
  const lens =
    isBranchless && storedActiveLens != null && !SIMPLE_LENSES.has(storedActiveLens)
      ? null
      : storedActiveLens;
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const selectedChildHome = useSelectedAgentHome(sessionId);
  const attachedWorkflowRuns = useAttachedWorkflowRuns({ session });
  const selectedWorkflowRun = useSelectedWorkflowRun({ session });
  const plans = useSessionPlans(sessionId);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
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
        selectedChildLabel,
        selectedChildHome,
        selectedParentLabel,
        selectedRootLabel,
        lensLabel: (kind: LensKind) => lensLabelFor({ lens: kind, isBranchless }),
        handlers: {
          toOverview: () => setActiveLens(sessionId, null),
          toLens: (l) => setActiveLens(sessionId, l),
          toWorkflowsList: () => {
            setFocusedWorkflowRun(sessionId, null);
            setActiveLens(sessionId, 'workflows');
          },
          toWorkflowRun: () => {
            if (selectedWorkflowRunId == null) {
              return;
            }
            setFocusedWorkflowRun(sessionId, selectedWorkflowRunId);
            setActiveLens(sessionId, 'workflows');
          },
          toPlansList: () => {
            setFocusedPlanId(sessionId, null);
            setActiveLens(sessionId, 'plans');
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
      selectedChildLabel,
      selectedChildHome,
      selectedParentLabel,
      selectedRootLabel,
      parentAgentId,
      rootAgentId,
      isBranchless,
      sessionId,
      setActiveLens,
      setFocusedWorkflowRun,
      setFocusedPlanId,
      selectAgent,
    ],
  );
};
