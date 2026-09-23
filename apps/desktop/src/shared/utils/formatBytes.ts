const UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

type Params = {
  readonly bytes: number;
};

export const formatBytes = ({ bytes }: Params): string => {
  if (bytes < 1024) {
    return `${Math.max(0, Math.round(bytes))} B`;
  }
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < UNITS.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${UNITS[index]}`;
};
