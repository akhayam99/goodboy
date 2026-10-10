import { useEffect, useMemo, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { withoutKeys } from '../../../../../store/slices/workflows/patchWorkflowRun';
import { DrawerHost } from '../../../DrawerHost';
import { PlanDrawerRunStub } from '../u21/PlanDrawerRunStub';
import { seedPlanDrawerScene } from '../u21/planDrawerSeed';
import { usePlanDrawerAutoplay } from '../u21/usePlanDrawerAutoplay';

const PRIMARY = '[data-testid="plan-primary"]';

const isApproveRequested = (): boolean =>
  new URLSearchParams(window.location.search).get('approve') === '1';

const seedOrchestratedRun = (): void => {
  seedPlanDrawerScene({ variant: 'follow' });
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((session) => ({
      ...session,
      workflowRuns: session.workflowRuns.map((run) => ({
        ...run,
        executionMode: 'dynamic' as const,
      })),
    })),
    sessionPhaseRuns: Object.fromEntries(
      Object.entries(state.sessionPhaseRuns).map(([sessionId, agents]) => [
        sessionId,
        agents?.filter((agent) => agent.kind !== 'implementer'),
      ]),
    ),
    approveWorkflowRunPlan: async (sessionId, workflowRunId) => {
      useAppStore.setState((current) => ({
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                workflowRuns: session.workflowRuns.map((run) => {
                  if (run.id !== workflowRunId) {
                    return run;
                  }
                  return {
                    ...withoutKeys(run, ['orchestrationStop']),
                    rulesSnapshot: run.rulesSnapshot && {
                      ...run.rulesSnapshot,
                      planApproved: true,
                    },
                  };
                }),
              }
            : session,
        ),
      }));
      return { kind: 'approved' as const, next: 'continues' as const, agentId: null };
    },
  }));
};

const PlanOwnerScene = () => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((state) => state.drawer !== null);
  const steps = useMemo(() => (isApproveRequested() ? [{ selector: PRIMARY }] : []), []);

  useEffect(() => {
    seedOrchestratedRun();
    setIsReady(true);
  }, []);

  usePlanDrawerAutoplay({ isReady, steps });

  if (!isReady) {
    return null;
  }

  return (
    <main data-testid="plan-owner-scene" className="flex h-screen bg-background text-foreground">
      <DrawerColumn
        main={<PlanDrawerRunStub />}
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        sizing={sizing}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const U24_P_PLAN_OWNER_SCENES = {
  'plan-drawer-approved': () => <PlanOwnerScene />,
};
