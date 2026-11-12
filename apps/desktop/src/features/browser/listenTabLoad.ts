import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';
import type { BrowserTabLoad } from './types';

const TAB_LOAD_EVENT = 'browser://tab-load';

type LoadParams = {
  readonly load: BrowserTabLoad;
};

type Params = {
  readonly onLoad: (params: LoadParams) => void;
};

export const listenTabLoad = async ({ onLoad }: Params): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<BrowserTabLoad>(TAB_LOAD_EVENT, (event) => onLoad({ load: event.payload }));
};
