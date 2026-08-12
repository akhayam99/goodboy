import type { BugReportImage } from './state';
import type { GetFn, SetFn } from './types';

export const BUG_REPORT_IMAGE_LIMIT = 4;

export type Params = {
  readonly images: ReadonlyArray<BugReportImage>;
};

export const addBugReportImages = (set: SetFn, get: GetFn) => {
  return ({ images }: Params): void => {
    const current = get().bugReportDraft;
    const room = BUG_REPORT_IMAGE_LIMIT - current.images.length;
    if (room <= 0 || images.length === 0) {
      return;
    }
    set({
      bugReportDraft: { ...current, images: [...current.images, ...images.slice(0, room)] },
    });
  };
};
