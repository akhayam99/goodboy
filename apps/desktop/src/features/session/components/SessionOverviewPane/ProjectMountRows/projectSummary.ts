type Params = {
  readonly openCount: number;
  readonly finishedCount: number;
};

export const projectSummaryOf = ({ openCount, finishedCount }: Params): string =>
  [
    openCount > 0 ? `${openCount} open` : null,
    finishedCount > 0 ? `${finishedCount} finished` : null,
  ]
    .filter((part) => part !== null)
    .join(', ');
