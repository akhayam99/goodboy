import { inlineMarkdownText } from '@goodboy/ui';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { commentPreviewOf } from './commentPreviewOf';
import { firstSentence } from './firstSentence';
import type { ReviewEntry } from './useReviewEntries';

export const entryBodyOf = ({ entry }: { readonly entry: ReviewEntry }): string | null => {
  const note = entry.row.reviewerNote;
  return note === null ? null : inlineMarkdownText({ text: note.body });
};

export const entryTitleOf = ({ entry }: { readonly entry: ReviewEntry }): string => {
  const note = entry.row.reviewerNote;
  if (note === null) {
    return RESOLVE_COMMENT_UNAVAILABLE;
  }
  const preview = commentPreviewOf({ text: note.body });
  return firstSentence({ text: preview.length > 0 ? preview : (entryBodyOf({ entry }) ?? '') });
};
