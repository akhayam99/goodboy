import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';

type Params = {
  readonly count: number;
};

export const setDockBadge = async ({ count }: Params): Promise<void> => {
  if (!isTauriRuntime()) {
    return;
  }
  await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined);
};
