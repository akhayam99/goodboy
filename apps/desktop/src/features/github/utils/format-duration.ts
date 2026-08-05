export const formatDuration = (ms: number | null): string => {
  if (ms === null) {
    return '';
  }
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  const s = Math.round(ms / 1_000);
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
};
