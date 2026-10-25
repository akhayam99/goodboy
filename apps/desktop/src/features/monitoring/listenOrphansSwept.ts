import { listen } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';
import { useAppStore } from '../../store';
import { isMainWindow } from '../workspace/window';

type Payload = {
  readonly count: number;
};

const isPayload = (value: unknown): value is Payload =>
  typeof value === 'object' &&
  value !== null &&
  'count' in value &&
  typeof value.count === 'number';

export const listenOrphansSwept = async (): Promise<() => void> => {
  if (!isTauriRuntime() || !isMainWindow()) {
    return () => undefined;
  }
  return listen<unknown>('orphans-swept', (event) => {
    if (isPayload(event.payload)) {
      useAppStore.getState().recordOrphansSwept({ count: event.payload.count });
    }
  });
};
