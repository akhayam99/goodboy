import { sendNotification } from '@tauri-apps/plugin-notification';
import type { WorkspaceId } from '@goodboy/types';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';
import type { AwayBanner } from './awayBannersOf';
import { isBannerAllowed } from './isBannerAllowed';

export type BannerOutcome = 'shown' | 'denied';

type Params = {
  readonly banner: AwayBanner;
  readonly workspaceId: WorkspaceId;
};

export const showAwayBanner = async ({ banner, workspaceId }: Params): Promise<BannerOutcome> => {
  if (!isTauriRuntime()) {
    return 'denied';
  }
  if (!(await isBannerAllowed())) {
    return 'denied';
  }
  sendNotification({
    title: banner.title,
    body: banner.body,
    extra: { workspaceId, sessionId: banner.sessionId, reason: banner.reason },
  });
  return 'shown';
};
