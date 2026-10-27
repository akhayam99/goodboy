import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseEndedWork } from './parseEndedWork';
import { SETTING_ENDED_WORK, SETTING_ENDED_WORK_SEEN } from './state';
import type { SliceDeps } from '../../slice-types';

export const loadEndedWork = ({ set, get }: SliceDeps) => {
  return async (): Promise<void> => {
    try {
      const raw = await getSetting(tauriDatabase, SETTING_ENDED_WORK);
      if (raw === null || raw === undefined || raw === '') {
        return;
      }
      const work = parseEndedWork({ raw });
      if (work === null) {
        return;
      }
      const seen = Number(await getSetting(tauriDatabase, SETTING_ENDED_WORK_SEEN));
      if (Number.isFinite(seen) && work.at <= seen) {
        return;
      }
      await setSetting(tauriDatabase, SETTING_ENDED_WORK_SEEN, String(work.at));
      set({ endedWork: work });
    } catch (error) {
      void get().reportError({
        title: 'Could not read what was running when Goodboy quit',
        error,
        severity: 'warning',
      });
    }
  };
};
