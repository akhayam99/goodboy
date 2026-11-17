import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_SESSIONS_CARD_CLOSED } from './state';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const hydrateSessionsCard = ({ set, get }: Params) => {
  return async (): Promise<void> => {
    if (get().sessionsCardPhase === 'closed') {
      return;
    }
    try {
      const closed = await getSetting(tauriDatabase, SETTING_SESSIONS_CARD_CLOSED);
      if (closed !== null && closed !== undefined && closed !== '') {
        set({ sessionsCardPhase: 'closed' });
        return;
      }
      if (get().sessionsCardPhase !== 'loading') {
        return;
      }
      const seen = get().changelogSeenVersion;
      const isFreshInstall = seen === null || seen === '';
      if (!isFreshInstall) {
        set({ sessionsCardPhase: 'open' });
        return;
      }
      set({ sessionsCardPhase: 'closed' });
      await setSetting(tauriDatabase, SETTING_SESSIONS_CARD_CLOSED, '1');
    } catch {
      if (get().sessionsCardPhase === 'loading') {
        set({ sessionsCardPhase: 'closed' });
      }
    }
  };
};
