import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutoLevel } from '@goodboy/core/auto';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { parseAutoLevelSetting } from '../../../../store/runtime/auto/level/parseAutoLevelSetting';
import { stopsLevelOf, type StopsLevel } from '../../stopsLevelOf';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type PickParams = {
  readonly next: AutoLevel;
};

type Held = {
  readonly workspaceId: WorkspaceId;
  readonly stops: StopsLevel;
};

const LEVEL_KEY = 'auto.level';

export const useStopsLevel = ({ workspaceId }: Params) => {
  const autonomy = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.workflowRules?.autonomy ?? null,
  );
  const raw = useAppStore((state) => state.workspaceValues[workspaceId]?.[LEVEL_KEY] ?? null);
  const loadWorkspaceValue = useAppStore((state) => state.loadWorkspaceValue);
  const changeStopsLevel = useAppStore((state) => state.changeStopsLevel);
  const reportError = useAppStore((state) => state.reportError);
  const [held, setHeld] = useState<Held | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const live = stopsLevelOf({ autonomy, autoLevel: parseAutoLevelSetting({ raw }).defaultLevel });
  const isBusy = held !== null && held.workspaceId === workspaceId;
  const stops = isBusy ? held.stops : live;

  useEffect(() => {
    setError(null);
    loadWorkspaceValue({ workspaceId, key: LEVEL_KEY }).catch((failure: unknown) => {
      void reportError({
        recovery: READ_FAILED,
        title: "Couldn't read when runs stop for you",
        error: failure,
        workspaceId,
      });
    });
  }, [workspaceId, loadWorkspaceValue, reportError]);

  const pick = useCallback(
    async ({ next }: PickParams): Promise<void> => {
      if (isSavingRef.current || (live.kind === 'same' && live.level === next)) {
        return;
      }
      isSavingRef.current = true;
      setHeld({ workspaceId, stops: live });
      setError(null);
      try {
        await changeStopsLevel({ workspaceId, level: next });
      } catch (failure) {
        setError(`Couldn't change it. ${formatError(failure)}`);
      } finally {
        isSavingRef.current = false;
        setHeld(null);
      }
    },
    [changeStopsLevel, live, workspaceId],
  );

  return { stops, error, isBusy, pick };
};
