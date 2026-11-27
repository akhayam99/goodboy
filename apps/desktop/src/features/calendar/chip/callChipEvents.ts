import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';
import type { CallAlert, ChipAction, ChipView } from './callChipTypes';

type PayloadParams<Payload> = {
  readonly payload: Payload;
};

type Handler<Payload> = {
  readonly onEvent: (params: PayloadParams<Payload>) => void;
};

type ListenParams<Payload> = Handler<Payload> & {
  readonly name: string;
};

const listenTo = async <Payload>({ name, onEvent }: ListenParams<Payload>): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<Payload>(name, ({ payload }) => onEvent({ payload }));
};

export const callChipEvents = {
  alerts: ({ onEvent }: Handler<CallAlert>) => listenTo({ name: 'calendar-alert', onEvent }),
  actions: ({ onEvent }: Handler<ChipAction>) =>
    listenTo({ name: 'calendar-chip-action', onEvent }),
  views: ({ onEvent }: Handler<ChipView>) => listenTo({ name: 'calendar-chip-view', onEvent }),
};
