import type { UnlistenFn } from '@tauri-apps/api/event';
import { listenPairingRequests } from './listenPairingRequests';
import { startCompanionProjections } from './projections/startCompanionProjections';

export const startCompanionBridge = async (): Promise<UnlistenFn> => {
  const { listenBridgeCommands } = await import('./commandExecutor');
  const [stopCommands, stopProjections, stopPairing] = await Promise.all([
    listenBridgeCommands(),
    startCompanionProjections(),
    listenPairingRequests(),
  ]);
  return () => {
    stopCommands();
    stopProjections();
    stopPairing();
  };
};
