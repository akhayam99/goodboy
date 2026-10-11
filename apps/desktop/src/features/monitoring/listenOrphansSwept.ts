import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../../store';

type Payload = {
  readonly count: number;
};

const isPayload = (value: unknown): value is Payload =>
  typeof value === 'object' &&
  value !== null &&
  'count' in value &&
  typeof value.count === 'number';

export const listenOrphansSwept = (): Promise<() => void> =>
  listen<unknown>('orphans-swept', (event) => {
    if (isPayload(event.payload)) {
      useAppStore.getState().recordOrphansSwept({ count: event.payload.count });
    }
  });
