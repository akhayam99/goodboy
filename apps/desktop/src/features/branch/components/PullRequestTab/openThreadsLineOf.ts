type Params = {
  readonly unresolved: number;
  readonly needYou: number;
};

export const openThreadsLineOf = ({ unresolved, needYou }: Params): string | null => {
  if (unresolved === 0) {
    return null;
  }
  const open = `${unresolved} open ${unresolved === 1 ? 'thread' : 'threads'}`;
  return needYou === 0 ? open : `${open} · ${needYou} ${needYou === 1 ? 'needs' : 'need'} you`;
};
