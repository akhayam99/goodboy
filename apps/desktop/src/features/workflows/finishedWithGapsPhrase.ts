type Params = {
  readonly count: number;
};

export const finishedWithGapsPhrase = ({ count }: Params): string =>
  `Finished, ${count} ${count === 1 ? 'step' : 'steps'} not finished`;
