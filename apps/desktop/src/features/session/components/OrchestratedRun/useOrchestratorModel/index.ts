import { useCallback, useMemo } from 'react';
import type { Session, WorkflowRun } from '@goodboy/types';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';
import { useAppStore } from '../../../../../store';
import { isRoutingModelKnown } from '../../../../../store/slices/workflows/orchestrateNextStep';
import { useRunModelDefault } from '../../../hooks/useRunModelDefault';
import { RUN_MODEL_COPY } from '../../../startRun/runModelCopy';
import { orchestratorRoutingOfPin } from '../../../startRun/runModelPin';
import { ORCHESTRATOR_SLOT } from '../../../startRun/runModelSlotOf';
import type { RunModelView } from '../../StartRun/useRunModel';

type Params = {
  readonly session: Session;
  readonly run: WorkflowRun;
};

export type OrchestratorModelModel = Readonly<{
  view: RunModelView;
  isDeciding: boolean;
}>;

export const useOrchestratorModel = ({ session, run }: Params): OrchestratorModelModel => {
  const sessionId = session.id;
  const runId = run.id;
  const setRouting = useAppStore((state) => state.setWorkflowOrchestratorRouting);
  const reportError = useAppStore((state) => state.reportError);
  const isDeciding = useAppStore((state) => state.orchestratingWorkflowRuns?.[runId] ?? false);
  const { suggestion, connectedProviders } = useRunModelDefault({
    workspaceId: session.workspaceId,
    sessionId,
    slot: ORCHESTRATOR_SLOT,
  });
  const routing = run.orchestratorRouting;
  const pinned = routing !== undefined && isRoutingModelKnown(routing) ? routing : null;

  const pick = useCallback(
    (route: PickedRoute | null): void => {
      const next =
        route === null || route.provider === ''
          ? null
          : orchestratorRoutingOfPin({
              pin: { provider: route.provider, model: route.model, effort: route.effort },
            });
      setRouting(sessionId, runId, next).catch((error: unknown) => {
        void reportError({ title: "Couldn't change the orchestrator model", error, sessionId });
      });
    },
    [reportError, runId, sessionId, setRouting],
  );

  const view = useMemo(
    (): RunModelView => ({
      slot: ORCHESTRATOR_SLOT,
      label: RUN_MODEL_COPY.orchestrator,
      effective:
        pinned === null
          ? suggestion
          : {
              provider: pinned.providerId,
              model: pinned.model,
              effort: pinned.effort ?? suggestion.effort,
            },
      suggestion,
      isPinned: pinned !== null,
      connectedProviders,
      pick,
    }),
    [connectedProviders, pick, pinned, suggestion],
  );
  return { view, isDeciding };
};
