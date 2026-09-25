export const SUGGESTED_LABEL = 'Suggested';

type AutoRecommendationCopy = {
  readonly label: string;
  readonly reason: string;
};

export const AUTO_RECOMMENDATION_COPY = {
  label: 'Auto',
  reason: 'Follows the workspace default provider. Goodboy picks the model this task needs.',
} satisfies AutoRecommendationCopy;
