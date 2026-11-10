import { selectDrawerPanel } from '../drawer/selectDrawerPanel';
import { leaveStudio } from '../navigation/leaveStudio';
import type { OpenContextDrawerParams } from './openContextDrawer';
import type { GetFn } from './types';

export const toggleContextDrawer = (get: GetFn) => {
  return (params: OpenContextDrawerParams): void => {
    const isOnPage = get().appStudio !== null;
    if (isOnPage) {
      leaveStudio({ get });
    }
    const state = get();
    const current = selectDrawerPanel(state);
    const isOpen =
      current !== null && current.kind === 'context' && current.sessionId === params.sessionId;
    const isSameSection =
      isOpen && (params.section === undefined || current.payload.section === params.section);
    if (isSameSection && isOnPage) {
      return;
    }
    if (isSameSection) {
      state.closeDrawer();
      return;
    }
    state.openContextDrawer(params);
  };
};
