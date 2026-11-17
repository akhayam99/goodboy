import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../../runtime/state-writes/commitAfterConfirm';
import { SETTING_SESSIONS_CARD_CLOSED } from './state';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const closeSessionsCard = ({ set, get }: Params) => {
  let isSaving = false;
  return async (): Promise<void> => {
    if (get().sessionsCardPhase !== 'open' || isSaving) {
      return;
    }
    isSaving = true;
    try {
      await commitAfterConfirm({
        get,
        failureTitle: 'Could not save that the Sessions card is closed',
        target: {},
        step: () => setSetting(tauriDatabase, SETTING_SESSIONS_CARD_CLOSED, '1'),
        commit: () => set({ sessionsCardPhase: 'closed' }),
      });
    } finally {
      isSaving = false;
    }
  };
};
