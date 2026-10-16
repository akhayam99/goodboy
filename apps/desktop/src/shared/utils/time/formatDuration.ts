type Params = {
  readonly durationMs: number;
  readonly hasTenths?: boolean;
};

export const formatDuration = ({ durationMs, hasTenths = false }: Params): string | null => {
  const safeMs = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
  if (safeMs < 1_000) {
    return null;
  }
  if (hasTenths && safeMs < 10_000) {
    return `${(Math.floor(safeMs / 100) / 10).toFixed(1)}s`;
  }
  const seconds = Math.round(safeMs / 1_000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};
