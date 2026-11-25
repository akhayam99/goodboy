import type { UnlistenFn } from '@tauri-apps/api/event';
import { startCompanionProjections } from './projections/startCompanionProjections';

export const startCompanionBridge = async (): Promise<UnlistenFn> => {
  const { listenBridgeCommands } = await import('./commandExecutor');
  const [stopCommands, stopProjections] = await Promise.all([
    listenBridgeCommands(),
    startCompanionProjections(),
  ]);
  return () => {
    stopCommands();
    stopProjections();
  };
};
