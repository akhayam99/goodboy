import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'search-folders', pattern: /\bSearch folders\b/, use: NAMES.searchProjects },
  { id: 'folder-filter', pattern: /\bFolder filter\b/, use: NAMES.projects },
  { id: 'port-or-folder', pattern: /\bPort or folder\b/, use: NAMES.searchPorts },
  { id: 'filter-collaborators', pattern: /\bfilter collaborators\b/i, use: NAMES.searchReviewers },
  { id: 'filter-commits', pattern: /\bfilter commits\b/i, use: NAMES.searchCommits },
  { id: 'find-a-session', pattern: /\bFind a session\b/, use: NAMES.searchSessions },
  { id: 'type-to-filter', pattern: /^Type to filter$/, use: NAMES.searchSessions },
  { id: 'group-colon', pattern: /^Group: /, use: NAMES.groupBy },
];
