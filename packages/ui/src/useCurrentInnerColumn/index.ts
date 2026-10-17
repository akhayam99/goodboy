import { useSyncExternalStore } from 'react';
import { innerColumnStore, type InnerColumn } from '../innerColumnStore';

export const useCurrentInnerColumn = (): InnerColumn | null =>
  useSyncExternalStore(
    innerColumnStore.subscribe,
    innerColumnStore.current,
    innerColumnStore.current,
  );
