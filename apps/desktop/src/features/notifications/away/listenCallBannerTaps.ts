import { onAction } from '@tauri-apps/plugin-notification';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';

type TapParams = {
  readonly eventId: string;
};

type Params = {
  readonly onTap: (params: TapParams) => void;
};

export const listenCallBannerTaps = async ({ onTap }: Params): Promise<() => void> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const listener = await onAction((event) => {
    if (event.actionId !== 'tap') {
      return;
    }
    const eventId = event.notification?.extra?.calendarEventId;
    if (typeof eventId !== 'string' || eventId === '') {
      return;
    }
    onTap({ eventId });
  });
  return () => {
    void listener.unregister();
  };
};
