import { clearBugReportDraft } from './clearBugReportDraft';
import { setBugReportDraft } from './setBugReportDraft';
import type { GetFn, SetFn } from './types';

export const createBugReportDraftSlice = (set: SetFn, get: GetFn) => {
  return {
    setBugReportDraft: setBugReportDraft(set, get),
    clearBugReportDraft: clearBugReportDraft(set),
  };
};
