type Params = {
  readonly elapsedMs: number;
};

const HOUR_MS = 3_600_000;

export const formatTailClock = ({ elapsedMs }: Params): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (elapsedMs < HOUR_MS) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};
