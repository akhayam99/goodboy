import type { PrComment, PrReview } from '@goodboy/types';
import { botKeyOf } from './botKeyOf';
import { reviewHeadsOf } from './reviewHeadsOf';

type Params = {
  readonly login: string;
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly reviews: ReadonlyArray<Pick<PrReview, 'author' | 'state' | 'body'>>;
};

export const botCommentCountOf = ({ login, comments, reviews }: Params): number => {
  const key = botKeyOf({ login });
  const heads = reviewHeadsOf({ comments, botKey: key }).length;
  const summaries = reviews.filter(
    (review) =>
      review.state === 'commented' &&
      review.body.trim() !== '' &&
      botKeyOf({ login: review.author }) === key,
  ).length;
  return heads + summaries;
};
