type Params = {
  readonly count: number;
};

export const agentCountLabelOf = ({ count }: Params): string => {
  if (count <= 0) {
    return '';
  }
  return `${count} ${count === 1 ? 'agent' : 'agents'}`;
};
