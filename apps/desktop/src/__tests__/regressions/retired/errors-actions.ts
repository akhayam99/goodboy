import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'board-remove-worktrees',
    pattern: /\bRetry removing (?:\d+ )?worktrees?\b|\bRemove (?:this worktree|\d+ worktrees)\?/,
    use: NAMES.deleteLocalBranches,
  },
];
