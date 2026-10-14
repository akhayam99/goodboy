import { formatDuration } from '../../../shared/utils/time/formatDuration';
import { useNow } from '../../../shared/hooks/useNow';

type Props = {
  readonly startedAtMs: number | null;
  readonly endedAtMs: number | null;
  readonly isLive: boolean;
};

export const DelegationClock = ({ startedAtMs, endedAtMs, isLive }: Props) => {
  const now = useNow(1_000, isLive && startedAtMs !== null);
  if (startedAtMs === null) {
    return null;
  }
  const end = isLive || endedAtMs === null ? now : endedAtMs;
  return (
    <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
      {formatDuration({ durationMs: Math.max(0, end - startedAtMs) })}
    </span>
  );
};
