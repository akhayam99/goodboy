import { SETTING_AUTO_PLAN_APPROVAL } from '../settings/settings';

type Params = {
  readonly settings: Readonly<Record<string, string>>;
};

export const isAutoPlanApprovalRequired = ({ settings }: Params): boolean =>
  settings[SETTING_AUTO_PLAN_APPROVAL] !== 'false';
