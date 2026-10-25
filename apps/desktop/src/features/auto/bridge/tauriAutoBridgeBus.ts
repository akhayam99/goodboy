import { emit, listen } from '@tauri-apps/api/event';
import type { AutoBridgeBus } from './autoBridgeProtocol';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';

export const tauriAutoBridgeBus: AutoBridgeBus = {
  emit: async ({ event, payload }) => {
    if (!isTauriRuntime()) {
      return;
    }
    await emit(event, payload);
  },
  listen: async ({ event, onPayload }) => {
    if (!isTauriRuntime()) {
      return () => undefined;
    }
    return listen<unknown>(event, (message) => onPayload(message.payload));
  },
};
