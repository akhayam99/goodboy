import { useEffect, useMemo } from 'react';
import type { RunRoute, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { parseRunRoutes, runRoutesKey } from '../../startRun/runRoutesSetting';

type Params = {
  readonly sessionId: SessionId;
};

export const useRunRoutes = ({ sessionId }: Params): Readonly<Record<string, RunRoute>> => {
  const key = runRoutesKey({ sessionId });
  const raw = useAppStore((state) => state.settings[key]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  useEffect(() => {
    loadSetting(key).catch((error: unknown) => {
      void reportError({
        recovery: READ_FAILED,
        title: "Couldn't read how this run was started",
        error,
      });
    });
  }, [key, loadSetting, reportError]);
  return useMemo(() => parseRunRoutes({ raw }), [raw]);
};
