type Params = {
  readonly hours: number | null;
};

export const formatHours = ({ hours }: Params): string => {
  if (hours === null) {
    return 'n/a';
  }
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
};
