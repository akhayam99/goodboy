import { useMemo } from 'react';
import { useDormantSpend, useSessions, useTelemetryForSessions } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { spendSources } from '../../../../shared/utils/spendSources';
import { dailySpendOf, type DailySpend } from '../../reads/dailySpendOf';

const CLOCK_MS = 60_000;

export const useDailySpend = (): DailySpend => {
  const sessions = useSessions();
  const telemetry = useTelemetryForSessions({ sessions });
  const dormant = useDormantSpend();
  const nowMs = useNow(CLOCK_MS);
  return useMemo(
    () =>
      dailySpendOf({
        sources: spendSources({ sessions, telemetryMap: telemetry, dormant }),
        nowMs,
      }),
    [dormant, nowMs, sessions, telemetry],
  );
};
