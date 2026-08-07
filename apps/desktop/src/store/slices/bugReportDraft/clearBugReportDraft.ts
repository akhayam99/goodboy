import { emptyBugReportDraft } from './state';
import type { SetFn } from './types';

export const clearBugReportDraft = (set: SetFn) => {
  return (): void => {
    set({ bugReportDraft: emptyBugReportDraft });
  };
};
