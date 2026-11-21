type Params = {
  readonly labels: ReadonlyArray<string>;
};

const LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export const couldntLoadTitle = ({ labels }: Params): string =>
  `Couldn't load ${LIST.format(labels)}`;
