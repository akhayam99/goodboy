import { insertNotification, type Notification } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  readonly ids: ReadonlyArray<string>;
};

type OfferParams = {
  readonly removed: ReadonlyArray<Notification>;
};

export const dismissNotificationGroup = (get: GetFn) => {
  const offerUndo = ({ removed }: OfferParams): void => {
    if (removed.length === 0) {
      return;
    }
    get().undoable({
      message:
        removed.length === 1 ? 'Notification deleted' : `${removed.length} notifications deleted`,
      conflictMessage: 'This notification changed. Nothing changed.',
      undo: async () => {
        for (const row of removed) {
          await insertNotification(tauriDatabase, row);
        }
        await get().loadNotifications();
        return true;
      },
    });
  };
  return async ({ ids }: Params): Promise<void> => {
    const removed: Array<Notification> = [];
    try {
      for (const id of ids) {
        const row = await get().dismissNotification(id);
        if (row !== undefined) {
          removed.push(row);
        }
      }
    } catch (error) {
      offerUndo({ removed });
      throw error;
    }
    offerUndo({ removed });
  };
};
