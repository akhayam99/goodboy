type Params = {
  durationMs: number;
};

export const formatStepDuration = ({ durationMs }: Params): string => {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }
  const seconds = Math.round(durationMs / 1_000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};
