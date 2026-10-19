type Params = {
  readonly ahead: number;
};

export const commitsAheadLabel = ({ ahead }: Params): string =>
  `${ahead} ${ahead === 1 ? 'commit' : 'commits'} ahead`;
