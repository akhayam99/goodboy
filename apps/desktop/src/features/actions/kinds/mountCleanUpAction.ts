import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ActionDefinition } from '../types';
import { cleanUpRefusalOf } from './cleanUpRefusalOf';
import type { MountFacts } from './mountFacts';

export const MOUNT_CLEAN_UP_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.cleanUp',
  label: 'Clean up',
  icon: CONCEPT_ICONS.delete,
  group: 'danger',
  when: ({ facts }) => !facts.isClosed && facts.worktreePath !== null && facts.pr === 'merged',
  slot: () => 'inline',
  pendingLabel: () => 'Cleaning up…',
  confirm: ({ facts }) => ({
    title: `Clean up ${facts.label}?`,
    description: 'Stops and says why if work is uncommitted or unpushed.',
    confirmLabel: 'Clean up',
    role: 'danger',
    goes: `Its folder and the local branch ${facts.branch}`,
    stays: 'The pull request, and the remote branch unless your after-merge setting removes it',
  }),
  run: async ({ facts, env }) => {
    const outcome = await env.getState().runAfterMergeCleanup({
      sessionId: facts.sessionId,
      mountId: facts.mountId,
      expectedBranch: facts.branch,
      mergedHeadSha: facts.mergedHeadSha ?? null,
      isRequested: true,
    });
    if (outcome.kind === 'deleted') {
      return;
    }
    throw new Error(cleanUpRefusalOf({ outcome, label: facts.label }));
  },
};
