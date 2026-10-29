import { DEFAULT_AUTO_LEVEL, type AutoLevel } from '@goodboy/core';
import type { Database } from '@goodboy/db';
import { autoLevelSetting, type AutoLevelTarget } from './autoLevelSetting';

type Params = { readonly db: Database; readonly target: AutoLevelTarget };

export const readAutoLevel = async ({ db, target }: Params): Promise<AutoLevel> => {
  const { value } = await autoLevelSetting({ db, target });
  if ('sessionId' in target) {
    return value.sessions[target.sessionId] ?? value.defaultLevel ?? DEFAULT_AUTO_LEVEL;
  }
  return value.defaultLevel ?? DEFAULT_AUTO_LEVEL;
};
