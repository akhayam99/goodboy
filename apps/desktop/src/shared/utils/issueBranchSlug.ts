import { MAX_SLUG_LENGTH, slugify } from '@goodboy/core';

type SlugParams = {
  readonly prefix: string;
  readonly title: string;
};

type MatchParams = SlugParams & {
  readonly branch: string;
};

type TitleSlugParams = {
  readonly title: string;
  readonly maxLength?: number;
};

export const issueBranchSlug = ({ prefix, title }: SlugParams): string =>
  slugify({ input: `${prefix}-${title}`, maxLength: MAX_SLUG_LENGTH });

export const titleBranchSlug = ({ title, maxLength = MAX_SLUG_LENGTH }: TitleSlugParams): string =>
  slugify({ input: title, maxLength, fallback: '' });

const legacyTitleSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');

const legacyIssueBranchSlug = ({ prefix, title }: SlugParams): string =>
  slugify({ input: `${prefix}-${legacyTitleSlug(title)}`, maxLength: MAX_SLUG_LENGTH });

const branchTail = (branch: string): string => {
  const lower = branch.toLowerCase();
  const index = lower.lastIndexOf('/');
  return index >= 0 ? lower.slice(index + 1) : lower;
};

export const issueBranchMatches = ({ branch, prefix, title }: MatchParams): boolean => {
  if (branch === '') {
    return false;
  }
  const tail = branchTail(branch);
  return (
    tail === issueBranchSlug({ prefix, title }) || tail === legacyIssueBranchSlug({ prefix, title })
  );
};
