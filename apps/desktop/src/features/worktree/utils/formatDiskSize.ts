const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

type Params = {
  readonly bytes: number;
};

export const formatDiskSize = ({ bytes }: Params): string => {
  if (bytes < 1) {
    return '0 B';
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value = value / 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unit]}`;
};
