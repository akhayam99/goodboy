import type { SessionId } from '@goodboy/types';
import type { ContextDrawerTab, ContextDrawerView } from '../drawer/state';
import { DEFAULT_CONTEXT_TAB } from './state';
import type { GetFn, SetFn } from './types';

export type OpenContextDrawerParams = {
  readonly sessionId: SessionId;
  readonly tab?: ContextDrawerTab;
  readonly view?: ContextDrawerView;
  readonly highlight?: ReadonlyArray<number>;
};

export const openContextDrawer = (set: SetFn, get: GetFn) => {
  return ({ sessionId, tab, view = 'current', highlight }: OpenContextDrawerParams): void => {
    const state = get();
    const nextTab = tab ?? state.contextDrawerTab[sessionId] ?? DEFAULT_CONTEXT_TAB;
    set({ contextDrawerTab: { ...state.contextDrawerTab, [sessionId]: nextTab } });
    state.openDrawer({
      kind: 'context',
      sessionId,
      payload: {
        tab: nextTab,
        view,
        ...(highlight !== undefined && highlight.length > 0 && { highlight }),
      },
    });
  };
};
