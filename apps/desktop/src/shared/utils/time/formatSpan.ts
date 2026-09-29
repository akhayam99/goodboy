type Params = {
  readonly from: string | number | null;
  readonly to: string | number;
};

export const formatSpan = ({ from, to }: Params): string => {
  if (from === null) {
    return '';
  }
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
};
