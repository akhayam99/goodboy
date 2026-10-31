import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AutoLevel } from '@goodboy/core';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import type { SessionDraftMount } from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { createLatestOnly } from '../../../../../store/runtime/state-writes/latestOnly';
import { rememberLastStart } from '../../../startKind/rememberLastStart';
import { applyStartEdits } from '../../../startRun/applyStartEdits';
import { draftStartOf } from '../../../startRun/draftStartOf';
import { pickedRouteOf } from '../../../startRun/pickedRouteOf';
import { agentRoutingOfPin, orchestratorRoutingOfPin } from '../../../startRun/runModelPin';
import { runModelSlotOfShape } from '../../../startRun/runModelSlotOf';
import { guidanceToSendOf } from '../../../startRun/guidanceToSendOf';
import { startRoutedRun } from '../../../startRun/startRoutedRun';
import { workspaceGuidanceOf } from '../../../startRun/workspaceGuidanceOf';
import type { StartLimit } from '../../../../auto/startLimitOf';
import type { LimitDefaultParams } from '../../../../auto/limitDefaultFrom';
import { limitDefaultFromOfKind } from '../../StartForm/limitDefaultFromOfKind';
import { startFormKindOfShape } from '../../StartForm/startFormKinds';
import type { RunModelModel } from '../../StartRun/useRunModel';
import { hasAsksGate } from '../hasAsksGate';
import { useStartFromDraft } from '../useStartFromDraft';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly mount: SessionDraftMount | null;
  readonly prepare: (params: LimitDefaultParams) => Promise<StartLimit>;
  readonly model: RunModelModel;
  readonly level: AutoLevel | null;
};

export type StartShapeModel = Readonly<{
  start: () => Promise<void>;
  isStarting: boolean;
  error: string | null;
}>;

const START_KEY = 'start-shape';

export const useStartShape = ({
  workspaceId,
  mount,
  prepare,
  model,
  level,
}: Params): StartShapeModel => {
  const { clear: clearModel, pinFor } = model;
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const latestRef = useRef(createLatestOnly());
  const startFromDraft = useStartFromDraft();
  const pickedShape = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startShape);

  useEffect(() => {
    if (!isStartingRef.current) {
      setError(null);
    }
  }, [pickedShape]);

  useEffect(() => {
    const latest = latestRef.current;
    return () => {
      latest.cancel({ key: START_KEY });
      isStartingRef.current = false;
      setIsStarting(false);
      setError(null);
    };
  }, [workspaceId]);

  const start = useCallback(async (): Promise<void> => {
    const state = useAppStore.getState();
    const draft = selectSessionDraft({ state, workspaceId });
    const shape = draft.startShape;
    const ask = draft.workflowGoal.trim();
    const preset =
      (state.phaseTemplates[workspaceId] ?? []).find(
        (workflow) => workflow.isPreset === true && workflow.id === draft.workflowId,
      ) ?? null;
    if (shape === null || ask === '' || isStartingRef.current) {
      return;
    }
    if (shape === 'preset' && preset === null) {
      return;
    }
    const claim = latestRef.current.claim({ key: START_KEY });
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      const limit =
        shape === 'agent'
          ? null
          : await prepare({
              defaultFrom: limitDefaultFromOfKind({ kind: startFormKindOfShape({ shape }) }),
            });
      const result = pickedRouteOf({
        shape,
        ask,
        preset,
        closeness: draft.presetCloseness,
        role: draft.agentKind,
      });
      const slot = runModelSlotOfShape({ shape, agentKind: draft.agentKind });
      const pin = shape === 'agent' ? null : pinFor({ slot });
      const routing =
        shape === 'agent'
          ? draft.agentRouting
          : pin !== null && slot.kind === 'agent'
            ? agentRoutingOfPin({ pin })
            : null;
      const orchestratorRouting =
        pin !== null && slot.kind === 'orchestrator' ? orchestratorRoutingOfPin({ pin }) : null;
      const autonomy = hasAsksGate({ shape }) ? draft.autonomy : null;
      const run = async (created: Session): Promise<void> => {
        await applyStartEdits({ sessionId: created.id, mode: draft.permissionMode });
        await startRoutedRun({
          sessionId: created.id,
          result,
          routing,
          orchestratorRouting,
          autonomy,
          level: shape === 'autoAgent' ? level : null,
          limit,
          guidance: guidanceToSendOf({
            picked: draft.guidance,
            workspace: workspaceGuidanceOf({ state, workspaceId }),
          }),
        });
      };
      await startFromDraft({
        workspaceId,
        start: draftStartOf({ picked: draft.pickedIssues, mount, ask, run }),
      });
      rememberLastStart({ workspaceId, last: shape });
      clearModel();
    } catch (cause) {
      if (claim.isCurrent()) {
        setError(formatError(cause));
      }
    } finally {
      if (claim.isCurrent()) {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    }
  }, [clearModel, level, mount, pinFor, prepare, startFromDraft, workspaceId]);

  return { start, isStarting, error };
};
