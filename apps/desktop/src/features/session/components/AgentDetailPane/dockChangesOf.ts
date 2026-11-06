import type { WorktreeStatus } from '@goodboy/types';
import { changedCount, distanceAhead } from '../../../../shared/lib/gitStatus';
import { pluralize } from '../../../../shared/utils/pluralize';

type Params = {
  readonly status: WorktreeStatus | undefined;
  readonly branch: string;
};

export const dockChangesOf = ({ status, branch }: Params): string | null => {
  if (status === undefined) {
    return null;
  }
  const changed = changedCount({ workingTree: status.workingTree }) ?? 0;
  if (changed > 0) {
    return `${pluralize(changed, 'file')} changed on ${branch}`;
  }
  const ahead = distanceAhead({ distance: status.mainDistance }) ?? 0;
  return ahead > 0 ? `${pluralize(ahead, 'commit')} on ${branch}` : null;
};
