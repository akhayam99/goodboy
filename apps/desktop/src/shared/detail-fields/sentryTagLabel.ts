const KNOWN_TAG_LABELS: ReadonlyMap<string, string> = new Map([
  ['release', 'Release'],
  ['environment', 'Environment'],
  ['os', 'OS'],
  ['browser', 'Browser'],
  ['runtime', 'Runtime'],
  ['device', 'Device'],
  ['transaction', 'Transaction'],
  ['url', 'URL'],
  ['user', 'User'],
  ['handled', 'Handled'],
  ['mechanism', 'Mechanism'],
  ['level', 'Level'],
]);

type Params = {
  readonly key: string;
};

export const sentryTagLabel = ({ key }: Params): string => KNOWN_TAG_LABELS.get(key) ?? key;
