import { clearBugReportDraft } from './clearBugReportDraft';
import { setBugReportDraft } from './setBugReportDraft';
import type { SliceDeps } from '../../slice-types';

export const createBugReportDraftSlice = ({ set, get }: SliceDeps) => {
  return {
    setBugReportDraft: setBugReportDraft(set, get),
    clearBugReportDraft: clearBugReportDraft(set),
  };
};
