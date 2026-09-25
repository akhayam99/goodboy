import { useEffect, useState } from 'react';
import type { DurationUnit, EstimateKey } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { historyWorkEstimate } from '../../agentWorkTime';
import type { WorkEstimate } from '../../workTime';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly key: EstimateKey;
  readonly unit: DurationUnit;
  readonly isShown: boolean;
};

export const useLaunchEstimate = ({
  workspaceId,
  key,
  unit,
  isShown,
}: Params): WorkEstimate | null => {
  const history = useAppStore((state) =>
    workspaceId === null ? undefined : state.workspaceDurationHistory?.[workspaceId],
  );
  const loadWorkspaceDurationHistory = useAppStore((state) => state.loadWorkspaceDurationHistory);
  const [nowMs] = useState(() => Date.now());
  const isLoaded = history !== undefined;

  useEffect(() => {
    if (!isShown || isLoaded || workspaceId === null) {
      return;
    }
    void loadWorkspaceDurationHistory?.({ workspaceId });
  }, [isLoaded, isShown, loadWorkspaceDurationHistory, workspaceId]);

  if (!isShown || history === undefined) {
    return null;
  }
  return historyWorkEstimate({ key, unit, history, nowMs });
};
