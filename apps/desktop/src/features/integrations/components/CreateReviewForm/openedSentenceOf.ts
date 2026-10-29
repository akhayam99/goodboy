import type { CreatedReview, CreateReviewNouns } from './types';

type Params = {
  readonly nouns: CreateReviewNouns;
  readonly created: CreatedReview;
};

export const openedSentenceOf = ({ nouns, created }: Params): string => {
  const noun = `${nouns.long.charAt(0).toUpperCase()}${nouns.long.slice(1)}`;
  return created.number === null ? `${noun} is open.` : `${noun} #${created.number} is open.`;
};
