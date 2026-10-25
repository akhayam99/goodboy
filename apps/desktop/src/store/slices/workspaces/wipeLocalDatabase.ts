import { setSetting as dbSetSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { wipeDb } from '../../../shared/lib/dbBoot';
import { wipeLocalStorage } from '../../../shared/lib/storage-keys';
import { SETTING_LAST_SESSION_ID } from '../../../features/settings/settings';
import type { AppState } from '../../types';
import type { GetFn, SetFn } from './types';

export const wipeLocalDatabase = (set: SetFn, get: GetFn, initialState: AppState) => {
  return async () => {
    await wipeDb();
    wipeLocalStorage();
    set({
      ...initialState,
      hydrated: get().hydrated,
      bootPhase: get().bootPhase,
      providers: get().providers,
      providerStatus: get().providerStatus,
      cursorStatus: get().cursorStatus,
      codexStatus: get().codexStatus,
      authResults: get().authResults,
      detectedEditors: get().detectedEditors,
    });
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
  };
};
