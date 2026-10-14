import {
  getSetting,
  insertSettingIfAbsent,
  replaceSettingIfUnchanged,
  type Database,
} from '@goodboy/db';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';

type Params = {
  readonly db: Database;
  readonly isOn: boolean;
};

type AttemptParams = {
  readonly db: Database;
  readonly desired: string;
};

const MAX_ATTEMPTS = 2;

const attempt = async ({ db, desired }: AttemptParams): Promise<boolean> => {
  const raw = await getSetting(db, SETTING_AUTO_EXPERIMENT);
  if (raw === desired) {
    return true;
  }
  if (raw === null) {
    return insertSettingIfAbsent({ db, key: SETTING_AUTO_EXPERIMENT, value: desired });
  }
  return replaceSettingIfUnchanged(db, {
    key: SETTING_AUTO_EXPERIMENT,
    expected: raw,
    value: desired,
  });
};

type CommittedParams = {
  readonly db: Database;
  readonly desired: string;
};

const isCommitted = async ({ db, desired }: CommittedParams): Promise<boolean> => {
  try {
    return (await getSetting(db, SETTING_AUTO_EXPERIMENT)) === desired;
  } catch {
    return false;
  }
};

export const writeAutoExperiment = async ({ db, isOn }: Params): Promise<void> => {
  const desired = isOn ? 'true' : 'false';
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    let isSettled: boolean;
    try {
      isSettled = await attempt({ db, desired });
    } catch (error) {
      if (await isCommitted({ db, desired })) {
        return;
      }
      throw error;
    }
    if (isSettled) {
      return;
    }
  }
  throw new Error('The Auto setting changed in another window, try again');
};
