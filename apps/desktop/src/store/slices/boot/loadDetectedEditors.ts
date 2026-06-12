import { detectEditors } from '../../../shared/lib/editor';
import type { GetFn, SetFn } from './types';

export const loadDetectedEditors = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    try {
      const editors = await detectEditors();
      set({ detectedEditors: editors });
    } catch {
      set({ detectedEditors: [] });
    }
  };
};
