import { emit, listen } from '@tauri-apps/api/event';
import type { AutoBridgeBus } from './autoBridgeProtocol';

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const tauriAutoBridgeBus: AutoBridgeBus = {
  emit: async ({ event, payload }) => {
    if (!inTauri()) {
      return;
    }
    await emit(event, payload);
  },
  listen: async ({ event, onPayload }) => {
    if (!inTauri()) {
      return () => undefined;
    }
    return listen<unknown>(event, (message) => onPayload(message.payload));
  },
};
