import type { PrReviewDraft } from '@goodboy/types';

export const FILE_LEVEL_LINE = 0;

export const isFileLevelDraft = ({ draft }: { readonly draft: PrReviewDraft }): boolean =>
  draft.line === FILE_LEVEL_LINE;
