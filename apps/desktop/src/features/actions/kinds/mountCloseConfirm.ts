import { countNoun } from '../../../shared/utils/countNoun';
import { NAMES } from '../../../shared/utils/names';
import type { ActionConfirm } from '../types';
import type { MountFacts } from './mountFacts';
import { hasWorkOnlyInFolderOf } from './hasWorkOnlyInFolderOf';
import { pinnedRunConfirm } from './pinnedRunConfirm';

type Params = {
  readonly facts: MountFacts;
};

const STAYS_NOTE = 'The branch and any pull request stay.';

const workWordsOf = ({ facts }: Params): string =>
  [
    facts.dirty > 0 &&
      countNoun({ count: facts.dirty, one: 'uncommitted change', many: 'uncommitted changes' }),
    facts.unpushed > 0 &&
      `${countNoun({ count: facts.unpushed, one: 'commit', many: 'commits' })} not pushed`,
  ]
    .filter((words) => words !== false)
    .join(' and ');

export const mountCloseConfirm = ({ facts }: Params): ActionConfirm => {
  if (facts.pinnedRunIds.length > 0) {
    return pinnedRunConfirm({ facts });
  }
  const title = `Close the branch for ${facts.label}?`;
  if (hasWorkOnlyInFolderOf({ facts })) {
    const work = workWordsOf({ facts });
    return {
      title,
      description: `It has ${work}. Its folder stays on disk.`,
      notes: [STAYS_NOTE],
      confirmLabel: NAMES.keepTheFolder,
      role: 'danger',
    };
  }
  return {
    title,
    description: 'Remove its folder or keep it on disk.',
    notes: [STAYS_NOTE],
    confirmLabel: NAMES.removeTheFolder,
    role: 'danger',
    altActionId: 'mount.closeKeepFolder',
    altLabel: NAMES.keepTheFolder,
  };
};
