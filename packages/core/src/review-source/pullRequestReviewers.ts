import type {
  PrReview,
  PrReviewRequest,
  PullRequestPerson,
  PullRequestReviewer,
} from '@goodboy/types';

const personOf = ({
  login,
  avatarUrl,
}: {
  readonly login: string;
  readonly avatarUrl?: string | null;
}): PullRequestPerson => ({ login, name: null, avatarUrl: avatarUrl ?? null });

const TERMINAL_REVIEW_STATES: ReadonlySet<PrReview['state']> = new Set([
  'approved',
  'changes_requested',
  'dismissed',
]);

export const pullRequestReviewersOf = ({
  reviews,
  requests,
}: {
  readonly reviews: ReadonlyArray<PrReview>;
  readonly requests: ReadonlyArray<PrReviewRequest>;
}): ReadonlyArray<PullRequestReviewer> => {
  const pending = new Set(requests.map((request) => request.login.toLowerCase()));
  const latest = new Map<string, PrReview>();
  for (const review of reviews) {
    if (review.state === 'pending') {
      continue;
    }
    const key = review.author.toLowerCase();
    const previous = latest.get(key);
    const isTerminal = TERMINAL_REVIEW_STATES.has(review.state);
    const previousIsTerminal = previous !== undefined && TERMINAL_REVIEW_STATES.has(previous.state);
    if (previous === undefined) {
      latest.set(key, review);
      continue;
    }
    if (previousIsTerminal && !isTerminal) {
      continue;
    }
    if (
      (isTerminal && !previousIsTerminal) ||
      (review.submittedAt ?? '') >= (previous.submittedAt ?? '')
    ) {
      latest.set(key, review);
    }
  }
  const reviewed = [...latest.values()]
    .filter((review) => !pending.has(review.author.toLowerCase()))
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))
    .map((review): PullRequestReviewer => ({
      person: personOf({ login: review.author, avatarUrl: review.authorAvatarUrl }),
      state: review.state,
    }));
  const awaiting = requests.map((request): PullRequestReviewer => ({
    person: personOf({ login: request.login, avatarUrl: request.avatarUrl }),
    state: 'pending',
  }));
  return [...reviewed, ...awaiting];
};
