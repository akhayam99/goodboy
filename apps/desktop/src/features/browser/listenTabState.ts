import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';
import type { BrowserTabFacts } from './types';

const TAB_STATE_EVENT = 'browser://tab-state';

type StateParams = {
  readonly facts: BrowserTabFacts;
};

type Params = {
  readonly onState: (params: StateParams) => void;
};

export const listenTabState = async ({ onState }: Params): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<BrowserTabFacts>(TAB_STATE_EVENT, (event) => onState({ facts: event.payload }));
};
