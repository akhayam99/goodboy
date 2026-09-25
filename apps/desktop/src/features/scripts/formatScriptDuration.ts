type Params = {
  readonly durationMs: number;
  readonly hasTenths?: boolean;
};

export const formatScriptDuration = ({ durationMs, hasTenths = false }: Params): string => {
  const safeMs = Math.max(0, durationMs);
  if (hasTenths && safeMs < 10_000) {
    return `${(Math.floor(safeMs / 100) / 10).toFixed(1)}s`;
  }
  const seconds = Math.floor(safeMs / 1_000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
