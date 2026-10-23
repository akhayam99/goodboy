import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import type { SessionDraftMount } from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { createLatestOnly } from '../../../../../store/slices/state-writes/latestOnly';
import { rememberLastStart } from '../../../startKind/rememberLastStart';
import { draftStartOf } from '../../../startRun/draftStartOf';
import { pickedRouteOf } from '../../../startRun/pickedRouteOf';
import { startRoutedRun } from '../../../startRun/startRoutedRun';
import { hasAsksGate } from '../hasAsksGate';
import { useStartFromDraft } from '../useStartFromDraft';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly mount: SessionDraftMount | null;
  readonly prepare: () => Promise<void>;
};

export type StartShapeModel = Readonly<{
  start: () => Promise<void>;
  isStarting: boolean;
  error: string | null;
}>;

const START_KEY = 'start-shape';

export const useStartShape = ({ workspaceId, mount, prepare }: Params): StartShapeModel => {
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
      if (shape !== 'agent') {
        await prepare();
      }
      const result = pickedRouteOf({
        shape,
        ask,
        preset,
        closeness: draft.presetCloseness,
        role: draft.agentKind,
      });
      const routing = shape === 'agent' ? draft.agentRouting : null;
      const autonomy = hasAsksGate({ shape }) ? draft.autonomy : null;
      const run = async (created: Session): Promise<void> => {
        await startRoutedRun({ sessionId: created.id, result, routing, autonomy });
      };
      await startFromDraft({
        workspaceId,
        start: draftStartOf({ picked: draft.pickedIssues, mount, ask, run }),
      });
      rememberLastStart({ workspaceId, last: shape });
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
  }, [mount, prepare, startFromDraft, workspaceId]);

  return { start, isStarting, error };
};
