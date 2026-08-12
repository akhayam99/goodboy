import { addBugReportImages } from './addBugReportImages';
import { clearBugReportDraft } from './clearBugReportDraft';
import { removeBugReportImage } from './removeBugReportImage';
import { setBugReportDraft } from './setBugReportDraft';
import type { GetFn, SetFn } from './types';

export const createBugReportDraftSlice = (set: SetFn, get: GetFn) => {
  return {
    setBugReportDraft: setBugReportDraft(set, get),
    addBugReportImages: addBugReportImages(set, get),
    removeBugReportImage: removeBugReportImage(set, get),
    clearBugReportDraft: clearBugReportDraft(set),
  };
};
