import type { ReviewablePr } from '@goodboy/types';

const DIFF_CHAR_LIMIT = 60000;

type Params = {
  pr: ReviewablePr;
  diff: string | null;
};

const prIdentifier = (pr: ReviewablePr): string =>
  pr.provider === 'gitlab' ? `!${pr.number}` : `#${pr.number}`;

const diffSection = (diff: string | null): string => {
  if (diff == null || diff === '') {
    return 'The diff could not be fetched. Ground your review in the checked-out code instead.';
  }
  const truncated =
    diff.length > DIFF_CHAR_LIMIT
      ? `${diff.slice(0, DIFF_CHAR_LIMIT)}\n[diff truncated at ${DIFF_CHAR_LIMIT} characters, full diff is ${diff.length} characters]`
      : diff;
  return ['```diff', truncated, '```'].join('\n');
};

export const buildPrReviewKickoff = ({ pr, diff }: Params): string => {
  return [
    'PR under review:',
    `- provider: ${pr.provider}`,
    `- number: ${prIdentifier(pr)}`,
    `- title: ${pr.title}`,
    `- author: ${pr.author}`,
    `- url: ${pr.url}`,
    `- branches: ${pr.headBranch} -> ${pr.baseBranch}`,
    '',
    'This is a read-only review session: the PR head branch is checked out in this worktree, and you must never edit, commit, push, or post anything to the provider.',
    '',
    'First produce a concise structured overview of the change (files touched, intent, risk areas), then wait for questions.',
    '',
    diffSection(diff),
  ].join('\n');
};
