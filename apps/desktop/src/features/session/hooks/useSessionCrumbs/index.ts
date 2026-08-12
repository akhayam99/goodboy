import { useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionPlans, type LensKind } from '../../../../store';
import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { useIsBranchlessSession } from '../useIsBranchlessSession';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { buildSessionBreadcrumb } from '../../components/SessionWorkspace/sessionBreadcrumb';
import { SIMPLE_LENSES, lensLabelFor } from '../../lens-labels';

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
  const attachedWorkflowRuns = useAttachedWorkflowRuns({ session });
  const plans = useSessionPlans(sessionId);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);

  const focusedWorkflowName = useMemo(() => {
    const focusedRun = attachedWorkflowRuns.find(({ run }) => run.id === focusedWorkflowRunId);
    return focusedRun == null ? null : workflowKindName(focusedRun.workflow);
  }, [focusedWorkflowRunId, attachedWorkflowRuns]);

  const focusedPlanTitle = useMemo(
    () => plans.find((p) => p.id === focusedPlanId)?.title ?? null,
    [plans, focusedPlanId],
  );

  return useMemo(
    () =>
      buildSessionBreadcrumb({
        lens,
        studio,
        focusedWorkflowName,
        focusedPlanTitle,
        lensLabel: (kind: LensKind) => lensLabelFor({ lens: kind, isBranchless }),
        handlers: {
          toOverview: () => setActiveLens(sessionId, null),
          toLens: (l) => setActiveLens(sessionId, l),
          toWorkflowsList: () => {
            setFocusedWorkflowRun(sessionId, null);
            setActiveLens(sessionId, 'workflows');
          },
          toPlansList: () => {
            setFocusedPlanId(sessionId, null);
            setActiveLens(sessionId, 'plans');
          },
        },
      }),
    [
      lens,
      studio,
      focusedWorkflowName,
      focusedPlanTitle,
      isBranchless,
      sessionId,
      setActiveLens,
      setFocusedWorkflowRun,
      setFocusedPlanId,
    ],
  );
};
