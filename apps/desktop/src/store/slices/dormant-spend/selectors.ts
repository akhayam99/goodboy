import type { DormantTelemetry } from '@goodboy/db';
import { useAppStore } from '../../store';
import type { AppState } from '../../types';

const NO_DORMANT_SPEND: ReadonlyArray<DormantTelemetry> = [];

const selectDormantSpend = (state: AppState): ReadonlyArray<DormantTelemetry> => {
  const dormant = state.dormantSpend;
  if (dormant === null || dormant.workspaceId !== state.currentWorkspaceId) {
    return NO_DORMANT_SPEND;
  }
  return dormant.entries;
};

export const useDormantSpend = (): ReadonlyArray<DormantTelemetry> =>
  useAppStore(selectDormantSpend);
