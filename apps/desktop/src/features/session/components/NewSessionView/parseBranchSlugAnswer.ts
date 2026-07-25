import { isValidBranchSlug } from '../../../../shared/utils/isValidBranchSlug';

const MAX_SLUG_LENGTH = 48;
const MAX_SLUG_WORDS = 5;
const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WRAPPING_NOISE = /^["'`]+|["'`.]+$/g;

type Params = {
  readonly answer: string;
};

export const parseBranchSlugAnswer = ({ answer }: Params): string | null => {
  const firstLine = answer.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const candidate = firstLine.trim().replace(WRAPPING_NOISE, '').trim().toLowerCase();
  if (candidate === '' || SLUG_SHAPE.test(candidate) === false) {
    return null;
  }
  const slug = candidate
    .split('-')
    .slice(0, MAX_SLUG_WORDS)
    .join('-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
  if (isValidBranchSlug({ slug }) === false) {
    return null;
  }
  return slug;
};
