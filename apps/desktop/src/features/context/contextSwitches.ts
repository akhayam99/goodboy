import { SETTING_CONTEXT_LEARNINGS } from '../settings/settings';

type Params = {
  readonly settings: Readonly<Record<string, string>>;
};

export const isLearningsOn = ({ settings }: Params): boolean =>
  settings[SETTING_CONTEXT_LEARNINGS] !== 'false';
