import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import type { ActionDefinition } from '../types';
import { closeMountKeepingFolder } from './closeMountKeepingFolder';
import type { MountFacts } from './mountFacts';

export const MOUNT_CLOSE_KEEP_FOLDER_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.closeKeepFolder',
  label: `${NAMES.closeBranch}, ${NAMES.keepTheFolder.toLowerCase()}`,
  icon: CONCEPT_ICONS.worktree,
  group: 'danger',
  when: ({ facts }) =>
    !facts.isClosed &&
    facts.worktreePath !== null &&
    !facts.isRebasing &&
    facts.pinnedRunIds.length === 0,
  slot: () => 'menu',
  placement: 'palette',
  pendingLabel: () => NAMES.closing,
  confirm: ({ facts }) => ({
    title: `Close the branch for ${facts.label}?`,
    description: 'Its folder stays on disk.',
    notes: ['The branch and any pull request stay.'],
    confirmLabel: NAMES.keepTheFolder,
    role: 'danger',
  }),
  run: closeMountKeepingFolder,
};
