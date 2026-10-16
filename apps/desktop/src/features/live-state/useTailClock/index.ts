import { useContext, useEffect, useState } from 'react';
import type { AgentId, IsoDateTime } from '@goodboy/types';
import { formatDuration } from '../../../shared/utils/time/formatDuration';
import { agentActiveClock } from '../../workTreeModel/agentWorkTime';
import { WorkTimeContext } from '../../workTreeModel/workTimeSource';

type Params = {
  readonly startedAt: IsoDateTime | null;
  readonly stepAgentId: AgentId | null;
  readonly isTicking: boolean;
  readonly isRunning: boolean;
};

const TICK_MS = 1_000;

export const useTailClock = ({
  startedAt,
  stepAgentId,
  isTicking,
  isRunning,
}: Params): string | null => {
  const source = useContext(WorkTimeContext);
  const [now, setNow] = useState(() => Date.now());
  const isWallClock = isTicking && stepAgentId === null && startedAt !== null;
  useEffect(() => {
    if (!isWallClock) {
      return;
    }
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(handle);
  }, [isWallClock, startedAt]);
  if (!isTicking) {
    return null;
  }
  if (stepAgentId !== null) {
    return source === null
      ? null
      : agentActiveClock({ agentId: stepAgentId, unit: 'step', isRunning, source });
  }
  if (startedAt === null) {
    return null;
  }
  return formatDuration({ durationMs: now - Date.parse(startedAt) });
};
