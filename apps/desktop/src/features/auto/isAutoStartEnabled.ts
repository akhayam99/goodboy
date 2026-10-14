import { AUTO_GATES } from '@goodboy/core';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';

type Params = {
  readonly settings: Readonly<Record<string, string>>;
  readonly isReleased?: boolean;
};

export const isAutoStartEnabled = ({
  settings,
  isReleased = AUTO_GATES.isDelegationEnabled,
}: Params): boolean => isReleased && settings[SETTING_AUTO_EXPERIMENT] === 'true';
