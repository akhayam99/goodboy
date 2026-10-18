type Params = {
  readonly picked: number;
  readonly total: number;
};

export const rebasePickLabelOf = ({ picked, total }: Params): string => {
  if (picked === 0) {
    return 'Rebase';
  }
  return picked === total ? 'Rebase all' : `Rebase ${picked}`;
};
