import type { PrDetail, PrReview, PullRequestState } from '@goodboy/types';

export const TAB_KEYS = ['ci', 'comments', 'review'] as const;
export type GithubTabKey = (typeof TAB_KEYS)[number];

export const TAB_LABEL: Record<GithubTabKey, string> = {
  ci: 'CI',
  comments: 'Comments',
  review: 'Review',
};

export const TAB_ICON_BTN =
  'rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export const COMMENT_DISPLAY_LIMIT = 5;

export const latestTerminalReviewsByAuthor = (
  reviews: ReadonlyArray<PrReview>,
): ReadonlyArray<PrReview> => {
  const map = new Map<string, PrReview>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    if (r.state === 'commented' || r.state === 'pending' || r.state === 'dismissed') {
      continue;
    }
    map.set(r.author, r);
  }
  return [...map.values()];
};

export const pickSmartTab = (
  pr: PullRequestState,
  detail: PrDetail | null,
  branchLastActivity: string | null,
): GithubTabKey => {
  const checks = detail?.checks ?? [];
  const hasFailing = checks.some(
    (c) =>
      c.conclusion === 'failure' ||
      c.conclusion === 'cancelled' ||
      c.conclusion === 'timed_out' ||
      c.conclusion === 'action_required',
  );
  const hasPending = checks.some((c) => c.conclusion === 'pending');
  if (hasFailing || hasPending) {
    return 'ci';
  }
  if (pr.checks === 'failure' || pr.checks === 'pending') {
    return 'ci';
  }

  const reviews = detail?.reviews ?? [];
  const latestByAuthor = latestTerminalReviewsByAuthor(reviews);
  if (latestByAuthor.some((review) => review.state === 'changes_requested')) {
    return 'review';
  }
  if (pr.reviewDecision === 'changes_requested') {
    return 'review';
  }

  const comments = detail?.comments ?? [];
  if (comments.length > 0) {
    const last = comments.reduce(
      (acc, c) => (c.createdAt > acc ? c.createdAt : acc),
      comments[0]!.createdAt,
    );
    const activity = branchLastActivity ?? pr.updatedAt;
    if (last > activity) {
      return 'comments';
    }
  }
  return 'ci';
};

export const formatDuration = (ms: number | null): string => {
  if (ms === null) {
    return '';
  }
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  const s = Math.round(ms / 1_000);
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
};
