import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ActionDefinition } from '../types';
import { cleanUpRefusalOf } from './cleanUpRefusalOf';
import type { MountFacts } from './mountFacts';
import { mountCleanUpWordsOf } from './mountCleanUpWordsOf';

export const MOUNT_CLEAN_UP_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.cleanUp',
  label: 'Clean up',
  icon: CONCEPT_ICONS.delete,
  group: 'danger',
  isUndoable: true,
  when: ({ facts }) => !facts.isClosed && facts.worktreePath !== null && facts.pr === 'merged',
  slot: () => 'inline',
  pendingLabel: () => 'Cleaning up…',
  confirm: ({ facts }) => ({
    title: `Clean up ${facts.label}?`,
    description: 'Stops and says why if work is uncommitted or unpushed.',
    confirmLabel: 'Clean up',
    role: 'danger',
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
      title: 'Worktree removed',
      message: 'Undo brings the branch back in a fresh folder.',
      undo: async () => {
        await env.getState().restoreDeletedBranch({ id: outcome.deleted.id });
        await env.getState().attachMount({ sessionId: facts.sessionId, mountId: facts.mountId });
      },
    });
  },
};
