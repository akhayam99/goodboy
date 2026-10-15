import { getSetting, type Database } from '@goodboy/db';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';
import { autoExperimentSettings } from './autoExperimentSettings';
import { isAutoStartEnabled } from './isAutoStartEnabled';

type Params = {
  readonly db: Database;
  readonly isReleased?: boolean;
};

export const readIsAutoOn = async ({ db, isReleased }: Params): Promise<boolean> => {
  const raw = await getSetting(db, SETTING_AUTO_EXPERIMENT);
  const settings = autoExperimentSettings({ raw });
  return isAutoStartEnabled({ settings, ...(isReleased !== undefined && { isReleased }) });
};
