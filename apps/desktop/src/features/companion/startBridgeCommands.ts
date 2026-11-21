import type { UnlistenFn } from '@tauri-apps/api/event';

export const startBridgeCommands = async (): Promise<UnlistenFn> => {
  const { listenBridgeCommands } = await import('./commandExecutor');
  return listenBridgeCommands();
};
