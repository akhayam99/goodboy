import type { SliceDeps } from '../../slice-types';
import type { SessionTabParams } from './types';

export const activateTab = ({ set }: SliceDeps) => {
  return ({ sessionId, tabId }: SessionTabParams): void => {
    set((state) => {
      const isKnown = (state.browserSessionTabs[sessionId] ?? []).some((tab) => tab.id === tabId);
      if (!isKnown) {
        return state;
      }
      return { browserActiveTab: { ...state.browserActiveTab, [sessionId]: tabId } };
    });
  };
};
