import { listProviderSessionIds } from '@goodboy/db';
import { cancelOtherToolsScan, scanOtherTools } from '../../../features/storage/otherTools';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadOtherTools = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const before = get().storageOtherTools;
    set({ storageOtherTools: { ...before, status: 'measuring' } });
    try {
      const [codexThreadIds, cursorChatIds] = await Promise.all([
        listProviderSessionIds({ db: tauriDatabase, providerId: 'codex' }),
        listProviderSessionIds({ db: tauriDatabase, providerId: 'cursor' }),
      ]);
      const scan = await scanOtherTools({ codexThreadIds, cursorChatIds });
      if (scan.status === 'cancelled') {
        set({ storageOtherTools: before });
        return;
      }
      set({ storageOtherTools: { status: 'ready', tools: scan.tools } });
    } catch (error) {
      set({ storageOtherTools: { ...before, status: 'failed' } });
      throw error;
    }
  };
};

export const cancelOtherTools = () => {
  return async (): Promise<void> => {
    await cancelOtherToolsScan();
  };
};
