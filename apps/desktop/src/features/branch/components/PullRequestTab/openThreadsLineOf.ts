type Params = {
  readonly unresolved: number;
  readonly newCount: number;
  readonly needYou: number;
};

export const openThreadsLineOf = ({ unresolved, newCount, needYou }: Params): string | null => {
  if (unresolved === 0) {
    return null;
  }
  const parts = [
    `${unresolved} open ${unresolved === 1 ? 'thread' : 'threads'}`,
    ...(newCount > 0 ? [`${newCount} new`] : []),
    ...(needYou > 0 ? [`${needYou} ${needYou === 1 ? 'needs' : 'need'} you`] : []),
  ];
  return parts.join(' · ');
};
