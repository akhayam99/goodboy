import { selectOpenDrawer } from '../drawer/selectOpenDrawer';
import type { OpenContextDrawerParams } from './openContextDrawer';
import type { GetFn } from './types';

export const toggleContextDrawer = (get: GetFn) => {
  return (params: OpenContextDrawerParams): void => {
    const state = get();
    const current = selectOpenDrawer(state);
    const isOpen =
      current !== null && current.kind === 'context' && current.sessionId === params.sessionId;
    if (isOpen && (params.tab === undefined || current.payload.tab === params.tab)) {
      state.closeDrawer();
      return;
    }
    state.openContextDrawer(params);
  };
};
