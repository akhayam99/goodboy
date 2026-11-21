import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'search-folders', pattern: /\bSearch folders\b/, use: NAMES.searchProjects },
  { id: 'folder-filter', pattern: /\bFolder filter\b/, use: NAMES.projects },
];
