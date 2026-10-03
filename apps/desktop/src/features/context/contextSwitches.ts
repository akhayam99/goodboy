import { SETTING_CONTEXT_LEARNINGS, SETTING_CONTEXT_ROLE_MAP } from '../settings/settings';

type Params = {
  readonly settings: Readonly<Record<string, string>>;
};

export const isRoleMapOn = ({ settings }: Params): boolean =>
  settings[SETTING_CONTEXT_ROLE_MAP] !== 'false';

export const isLearningsOn = ({ settings }: Params): boolean =>
  settings[SETTING_CONTEXT_LEARNINGS] !== 'false';
