import { pluralize } from '../utils/pluralize';

export const mergedThenLabel = (newCommits: number): string =>
  `Merged, then ${pluralize(newCommits, 'new commit')}`;
