import { inlineMarkdownText } from '@goodboy/ui';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { firstSentence } from './firstSentence';
import type { ReviewEntry } from './useReviewEntries';

export const entryBodyOf = ({ entry }: { readonly entry: ReviewEntry }): string | null => {
  const note = entry.row.reviewerNote;
  return note === null ? null : inlineMarkdownText({ text: note.body });
};

export const entryTitleOf = ({ entry }: { readonly entry: ReviewEntry }): string => {
  const body = entryBodyOf({ entry });
  return body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
};
