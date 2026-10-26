import { overrideState } from './overrideState';

type Params = {
  readonly overrides: Readonly<Record<string, string>>;
};

export const setShortcutOverrides = ({ overrides }: Params): void => {
  overrideState.overrides = overrides;
};
