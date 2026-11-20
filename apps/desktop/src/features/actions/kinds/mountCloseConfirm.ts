import { countNoun } from '../../../shared/utils/countNoun';
import { NAMES } from '../../../shared/utils/names';
import type { ActionConfirm } from '../types';
import type { MountFacts } from './mountFacts';
import { pinnedRunConfirm } from './pinnedRunConfirm';

type Params = {
  readonly facts: MountFacts;
};

export const mountCloseConfirm = ({ facts }: Params): ActionConfirm => {
  if (facts.pinnedRunIds.length > 0) {
    return pinnedRunConfirm({ facts });
  }
  if (facts.pr === 'merged') {
    return {
      title: `Close the branch for ${facts.label}?`,
      description: 'Its folder goes. The local branch and its commits stay.',
      confirmLabel: NAMES.closeBranch,
      role: 'danger',
    };
  }
  const changes = countNoun({
    count: facts.dirty,
    one: 'uncommitted change',
    many: 'uncommitted changes',
  });
  return {
    title: `Close the branch for ${facts.label}?`,
    description:
      facts.dirty > 0
        ? `The branch and any pull request stay, and the ${changes} stay on disk.`
        : 'Its folder is removed. The branch and any pull request stay.',
    confirmLabel: facts.dirty > 0 ? 'Close, keep changes' : NAMES.closeBranch,
    role: 'alert',
  };
};
