type Params = {
  readonly part: number;
  readonly total: number;
  readonly noun?: string;
};

export const formatShare = ({ part, total, noun }: Params): string => {
  if (total <= 0) {
    return 'No data';
  }
  if (total < 5) {
    return noun == null ? `${part} of ${total}` : `${part} of ${total} ${noun}`;
  }
  return `${Math.round((part / total) * 100)}%`;
};
