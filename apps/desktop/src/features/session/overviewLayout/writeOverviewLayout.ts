import {
  getSetting,
  insertSettingIfAbsent,
  replaceSettingIfUnchanged,
  type Database,
} from '@goodboy/db';
import { SETTING_OVERVIEW_LAYOUT } from '../../settings/settings';
import type { OverviewLayout } from './overviewLayoutOf';

type Params = {
  readonly db: Database;
  readonly layout: OverviewLayout;
};

const MAX_ATTEMPTS = 2;

const attempt = async ({ db, layout }: Params): Promise<boolean> => {
  const raw = await getSetting(db, SETTING_OVERVIEW_LAYOUT);
  if (raw === layout) {
    return true;
  }
  if (raw === null) {
    return insertSettingIfAbsent({ db, key: SETTING_OVERVIEW_LAYOUT, value: layout });
  }
  return replaceSettingIfUnchanged(db, {
    key: SETTING_OVERVIEW_LAYOUT,
    expected: raw,
    value: layout,
  });
};

const isCommitted = async ({ db, layout }: Params): Promise<boolean> => {
  try {
    return (await getSetting(db, SETTING_OVERVIEW_LAYOUT)) === layout;
  } catch {
    return false;
  }
};

export const writeOverviewLayout = async ({ db, layout }: Params): Promise<void> => {
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    let isSettled: boolean;
    try {
      isSettled = await attempt({ db, layout });
    } catch (error) {
      if (await isCommitted({ db, layout })) {
        return;
      }
      throw error;
    }
    if (isSettled) {
      return;
    }
  }
  throw new Error('The overview setting changed in another window, try again');
};
