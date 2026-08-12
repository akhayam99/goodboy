import type { GetFn, SetFn } from './types';

export type Params = {
  readonly imageId: string;
};

export const removeBugReportImage = (set: SetFn, get: GetFn) => {
  return ({ imageId }: Params): void => {
    const current = get().bugReportDraft;
    set({
      bugReportDraft: {
        ...current,
        images: current.images.filter((image) => image.id !== imageId),
      },
    });
  };
};
