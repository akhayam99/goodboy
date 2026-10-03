import { detectBrowsers } from '../../../shared/lib/editor';
import type { GetFn, SetFn } from './types';

export const loadDetectedBrowsers = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    try {
      const browsers = await detectBrowsers();
      set({ detectedBrowsers: browsers });
    } catch {
      set({ detectedBrowsers: [] });
    }
  };
};
