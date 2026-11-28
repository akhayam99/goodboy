import { sendNotification } from '@tauri-apps/plugin-notification';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';
import type { BannerOutcome } from './showAwayBanner';
import { isBannerAllowed } from './isBannerAllowed';

type Params = {
  readonly eventId: string;
  readonly title: string;
  readonly body: string;
};

export const showCallBanner = async ({ eventId, title, body }: Params): Promise<BannerOutcome> => {
  if (!isTauriRuntime()) {
    return 'denied';
  }
  if (!(await isBannerAllowed())) {
    return 'denied';
  }
  sendNotification({ title, body, extra: { calendarEventId: eventId } });
  return 'shown';
};
