import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { countNoun } from '../../../shared/utils/countNoun';
import { NAMES } from '../../../shared/utils/names';
import type { ActionDefinition } from '../types';
import { cleanUpRefusalOf } from './cleanUpRefusalOf';
import { hasWorkOnlyInFolderOf } from './hasWorkOnlyInFolderOf';
import type { MountFacts } from './mountFacts';
import { mountCleanUpWordsOf } from './mountCleanUpWordsOf';

const CLOSE_INSTEAD_NOTE = `${NAMES.closeBranch} keeps the local branch and removes the folder.`;

const CLOSE_KEEPING_NOTE = `${NAMES.closeBranch} keeps the local branch and the folder.`;

type Params = {
  readonly facts: MountFacts;
};

const notesOf = ({ facts }: Params): ReadonlyArray<string> =>
  facts.dirty > 0
    ? [
        `${countNoun({ count: facts.dirty, one: 'file is', many: 'files are' })} not committed in its folder. Delete stops and keeps them.`,
        CLOSE_KEEPING_NOTE,
      ]
    : [hasWorkOnlyInFolderOf({ facts }) ? CLOSE_KEEPING_NOTE : CLOSE_INSTEAD_NOTE];

export const MOUNT_CLEAN_UP_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.cleanUp',
  label: `${NAMES.deleteLocalBranch}…`,
  icon: CONCEPT_ICONS.delete,
  group: 'danger',
  isUndoable: true,
  when: ({ facts }) => !facts.isClosed && facts.worktreePath !== null && facts.pr === 'merged',
  slot: () => 'inline',
  pendingLabel: () => 'Deleting…',
  confirm: ({ facts }) => ({
    title: `Delete the local branch ${facts.branch}?`,
    description:
      'Its folder goes too. Your after-merge setting decides about the branch on origin.',
    confirmLabel: NAMES.deleteLocalBranch,
    role: 'danger',
    altActionId: 'mount.close',
    altLabel: NAMES.closeBranch,
    notes: notesOf({ facts }),
    ...mountCleanUpWordsOf({ facts }),
  }),
  run: async ({ facts, env }) => {
    const outcome = await env.getState().runAfterMergeCleanup({
      sessionId: facts.sessionId,
      mountId: facts.mountId,
      expectedBranch: facts.branch,
      mergedHeadSha: facts.mergedHeadSha ?? null,
      isRequested: true,
    });
    if (outcome.kind !== 'deleted') {
      throw new Error(cleanUpRefusalOf({ outcome, label: facts.label }));
    }
    env.getState().undoable({
      showToast: env.showToast,
      title: `Deleted ${facts.branch}`,
      message: 'Undo brings the branch back in a fresh folder.',
      undo: async () => {
        await env.getState().restoreDeletedBranch({ id: outcome.deleted.id });
        await env.getState().attachMount({ sessionId: facts.sessionId, mountId: facts.mountId });
      },
    });
  },
};
