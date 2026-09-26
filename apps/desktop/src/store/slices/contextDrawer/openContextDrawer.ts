import type { SessionId } from '@goodboy/types';
import type { ContextDrawerTab, ContextDrawerView } from '../drawer/state';
import { DEFAULT_CONTEXT_TAB } from './state';
import type { GetFn, SetFn } from './types';

export type OpenContextDrawerParams = {
  readonly sessionId: SessionId;
  readonly tab?: ContextDrawerTab;
  readonly view?: ContextDrawerView;
};

export const openContextDrawer = (set: SetFn, get: GetFn) => {
  return ({ sessionId, tab, view = 'current' }: OpenContextDrawerParams): void => {
    const state = get();
    const nextTab = tab ?? state.contextDrawerTab[sessionId] ?? DEFAULT_CONTEXT_TAB;
    set({ contextDrawerTab: { ...state.contextDrawerTab, [sessionId]: nextTab } });
    state.openDrawer({ kind: 'context', sessionId, payload: { tab: nextTab, view } });
  };
};
