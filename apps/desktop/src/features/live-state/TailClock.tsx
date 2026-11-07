import type { AgentId, IsoDateTime } from '@goodboy/types';
import { useTailClock } from './useTailClock';

type Props = {
  readonly startedAt: IsoDateTime | null;
  readonly stepAgentId: AgentId | null;
  readonly isRunning: boolean;
};

export const TailClock = ({ startedAt, stepAgentId, isRunning }: Props) => {
  const clock = useTailClock({ startedAt, stepAgentId, isTicking: true, isRunning });
  return clock === null ? null : (
    <span aria-hidden="true" className="shrink-0 tabular-nums text-faint-foreground">
      {clock}
    </span>
  );
};
