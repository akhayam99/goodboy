import { relaunch } from '@tauri-apps/plugin-process';
import { invokeCommand } from '../../../shared/lib/invokeCommand';

export const moveDatabaseAside = () => {
  return async (): Promise<void> => {
    await invokeCommand<string>('db_move_aside');
    await relaunch();
  };
};
