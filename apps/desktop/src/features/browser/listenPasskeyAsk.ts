import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';
import type { BrowserPasskeyEvent } from './types';

const PASSKEY_EVENT = 'browser://passkey';

type AskParams = {
  readonly ask: BrowserPasskeyEvent;
};

type Params = {
  readonly onAsk: (params: AskParams) => void;
};

export const listenPasskeyAsk = async ({ onAsk }: Params): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<BrowserPasskeyEvent>(PASSKEY_EVENT, (event) => onAsk({ ask: event.payload }));
};
