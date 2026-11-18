import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import type { ResolveThread } from '@goodboy/types';
import { COMMENT_RUN_COPY } from './commentRunCopy';

type Params = {
  readonly thread: Pick<ResolveThread, 'originKind' | 'sourceKind'>;
};

export const commentRunSourceLabelOf = ({ thread }: Params): string =>
  thread.originKind === 'diff_comment'
    ? COMMENT_RUN_COPY.note
    : REVIEW_SOURCE_LABEL[thread.sourceKind ?? 'github'];
