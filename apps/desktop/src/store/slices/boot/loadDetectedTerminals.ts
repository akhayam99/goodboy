import { detectTerminals } from '../../../shared/lib/terminalApp';
import type { SliceDeps } from '../../slice-types';

export const loadDetectedTerminals = ({ set, get }: SliceDeps) => {
  return async (): Promise<void> => {
    try {
      const terminals = await detectTerminals();
      set({ detectedTerminals: terminals ?? [] });
    } catch (error) {
      set({ detectedTerminals: [] });
      void get().reportError({
        title: "Couldn't read which terminal apps are installed",
        error,
        severity: 'warning',
      });
    }
  };
};
