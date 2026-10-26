import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { WorkspaceId } from '@goodboy/types';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';
import type { AwayBanner } from './awayBannersOf';

export type BannerOutcome = 'shown' | 'denied';

type Params = {
  readonly banner: AwayBanner;
  readonly workspaceId: WorkspaceId;
};

const isGranted = async (): Promise<boolean> => {
  if (await isPermissionGranted()) {
    return true;
  }
  return (await requestPermission()) === 'granted';
};

export const showAwayBanner = async ({ banner, workspaceId }: Params): Promise<BannerOutcome> => {
  if (!isTauriRuntime()) {
    return 'denied';
  }
  if (!(await isGranted())) {
    return 'denied';
  }
  sendNotification({
    title: banner.title,
    body: banner.body,
    extra: { workspaceId, sessionId: banner.sessionId, reason: banner.reason },
  });
  return 'shown';
};
