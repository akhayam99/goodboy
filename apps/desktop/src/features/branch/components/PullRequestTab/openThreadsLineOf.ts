type Params = {
  readonly unresolved: number;
  readonly unreadCount: number;
  readonly needYou: number;
};

export const openThreadsLineOf = ({ unresolved, unreadCount, needYou }: Params): string | null => {
  if (unresolved === 0) {
    return null;
  }
  const parts = [
    `${unresolved} open ${unresolved === 1 ? 'thread' : 'threads'}`,
    ...(needYou > 0 ? [`${needYou} ${needYou === 1 ? 'needs' : 'need'} you`] : []),
    ...(unreadCount > 0 ? [`${unreadCount} unread`] : []),
  ];
  return parts.join(' · ');
};
