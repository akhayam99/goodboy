import { settleStaleNotifications as settleStaleNotificationsDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { CHECK_STATE } from './errorRecovery';
import { FIRST_PASS_BEFORE_MS } from './firstPassCutoff';
import { processLaunchStampOf } from './processLaunchStamp';
import type { GetFn } from './types';

const SETTLE_FAILED_KEY = 'settle-notifications-failed';

export const writeSettledNotifications = async (): Promise<void> => {
  await settleStaleNotificationsDb({
    db: tauriDatabase,
    nowMs: Date.now(),
    launchStampMs: await processLaunchStampOf(),
    firstPassBeforeMs: FIRST_PASS_BEFORE_MS,
  });
};

type FactoryParams = {
  readonly get: GetFn;
};

export const settleStaleNotifications = ({ get }: FactoryParams) => {
  return async (): Promise<void> => {
    try {
      await get().loadNotifications();
    } catch (error) {
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't tidy the notifications",
        error,
        coalesceKey: SETTLE_FAILED_KEY,
      });
    }
  };
};
