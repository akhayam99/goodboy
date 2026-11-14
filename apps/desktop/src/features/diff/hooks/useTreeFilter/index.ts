import { useMemo, type ComponentProps } from 'react';
import type { ChangeTree } from '../../components/ChangeTree';
import type { ReviewState } from '../useReviewState';

type Params = {
  readonly review: ReviewState;
};

export type TreeFilter = ComponentProps<typeof ChangeTree>['filter'];

export const useTreeFilter = ({ review }: Params): TreeFilter =>
  useMemo(
    () => ({
      query: review.query,
      onQuery: review.setQuery,
      unviewedOnly: review.unviewedOnly,
      onUnviewedOnly: review.setUnviewedOnly,
      commentedOnly: review.commentedOnly,
      onCommentedOnly: review.setCommentedOnly,
      group: review.group,
      onGroup: review.setGroup,
      isFiltering: review.isFiltering,
      onClear: review.clearFilters,
    }),
    [
      review.clearFilters,
      review.group,
      review.isFiltering,
      review.commentedOnly,
      review.query,
      review.setCommentedOnly,
      review.setGroup,
      review.setQuery,
      review.setUnviewedOnly,
      review.unviewedOnly,
    ],
  );
