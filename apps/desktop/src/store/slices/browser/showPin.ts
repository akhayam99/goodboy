import type { SliceDeps } from '../../slice-types';
import type { SessionTabParams } from './types';

export const showPin = ({ set }: SliceDeps) => {
  return ({ sessionId, tabId }: SessionTabParams): void => {
    set((state) => ({ browserShownPin: { ...state.browserShownPin, [sessionId]: tabId } }));
  };
};
