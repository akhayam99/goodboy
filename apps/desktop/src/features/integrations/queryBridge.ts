import { invoke } from '@tauri-apps/api/core';

export const isQueryBridgeServing = async (): Promise<boolean> => {
  try {
    return await invoke<boolean>('query_bridge_serving');
  } catch {
    return false;
  }
};
