import type { ProjectId, SearchKind, SearchQuery } from '@goodboy/types';
import type { SearchChip } from './searchChips';
import type { SearchScope } from './searchScope';

const SEARCH_RESULT_LIMIT = 40;

type Params = {
  readonly text: string;
  readonly scope: SearchScope;
  readonly chips: ReadonlyArray<SearchChip>;
};

export const toSearchQuery = ({ text, scope, chips }: Params): SearchQuery => {
  const kinds: SearchKind[] = [];
  const projectIds: ProjectId[] = [];
  const providers: string[] = [];
  const statuses: string[] = [];
  let after: number | null = null;
  let before: number | null = null;
  let isArchived = false;
  for (const chip of chips) {
    switch (chip.key) {
      case 'type':
        kinds.push(...chip.kinds);
        break;
      case 'project':
        projectIds.push(chip.projectId);
        break;
      case 'provider':
        providers.push(chip.provider);
        break;
      case 'status':
        statuses.push(chip.status);
        break;
      case 'archived':
        isArchived = true;
        break;
      case 'after':
        after = chip.at;
        break;
      case 'before':
        before = chip.at;
        break;
      default: {
        const exhaustive: never = chip;
        return exhaustive;
      }
    }
  }
  return {
    text,
    kinds: [...new Set(kinds)],
    workspaceId: scope.kind === 'all' ? null : scope.workspaceId,
    sessionId: scope.kind === 'session' ? scope.sessionId : null,
    projectIds,
    providers,
    statuses,
    after,
    before,
    archived: isArchived ? 'only' : 'exclude',
    limit: SEARCH_RESULT_LIMIT,
  };
};
