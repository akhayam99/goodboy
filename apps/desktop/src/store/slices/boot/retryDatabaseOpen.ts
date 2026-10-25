import { relaunch } from '@tauri-apps/plugin-process';
import { invokeCommand } from '../../../shared/lib/invokeCommand';

export const retryDatabaseOpen = () => {
  return async (): Promise<void> => {
    await invokeCommand('db_check_openable');
    await relaunch();
  };
};
