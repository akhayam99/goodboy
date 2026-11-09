import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';
import type { BrowserTabFacts } from './types';

const TAB_OPENED_EVENT = 'browser://tab-opened';

type OpenedParams = {
  readonly facts: BrowserTabFacts;
};

type Params = {
  readonly onOpened: (params: OpenedParams) => void;
};

export const listenTabOpened = async ({ onOpened }: Params): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<BrowserTabFacts>(TAB_OPENED_EVENT, (event) => onOpened({ facts: event.payload }));
};
