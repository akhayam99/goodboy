import { countNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

let latestRequest = 0;

type RefreshParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const refreshNotificationCounts = async ({ set, get }: RefreshParams): Promise<void> => {
  latestRequest += 1;
  const request = latestRequest;
  const workspaceId = get().currentWorkspaceId;
  const notificationCounts = await countNotifications({ db: tauriDatabase, workspaceId }).catch(
    () => null,
  );
  if (
    notificationCounts == null ||
    request !== latestRequest ||
    get().currentWorkspaceId !== workspaceId
  ) {
    return;
  }
  set({ notificationCounts });
};
