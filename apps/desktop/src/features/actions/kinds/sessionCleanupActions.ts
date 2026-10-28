import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ActionDefinition } from '../types';
import { cleanUpRefusalOf } from './cleanUpRefusalOf';
import { mergedMountsOf } from './mergedMountsOf';
import type { SessionFacts } from './session';

export const CLEAN_UP_MERGED_MIN_BRANCHES = 2;

export const SESSION_CLEANUP_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.cleanUpMerged',
    label: 'Clean up merged branches',
    shortLabel: ({ facts }) => `Clean up ${facts.mergedMountIds.length} merged`,
    description: ({ facts }) => `${facts.mergedMountIds.length} merged branches`,
    icon: CONCEPT_ICONS.delete,
    group: 'danger',
    when: ({ facts }) =>
      !facts.isArchived && facts.mergedMountIds.length >= CLEAN_UP_MERGED_MIN_BRANCHES,
    slot: () => 'inline',
    pendingLabel: () => 'Cleaning up…',
    confirm: ({ facts }) => ({
      title: `Clean up ${facts.mergedMountIds.length} merged branches?`,
      description: 'Removes each folder and local branch.',
      notes: ['A branch with uncommitted or unpushed work stays, and says why.'],
      confirmLabel: 'Clean up',
      role: 'danger',
      goes: 'The folder and the local branch of each one',
      stays: 'The pull requests, and any branch holding work',
      items: facts.mergedBranches,
    }),
    run: async ({ facts, env }) => {
      const refusals: Array<string> = [];
      const mounts = mergedMountsOf({ state: env.getState(), sessionId: facts.sessionId });
      for (const mount of mounts) {
        if (!facts.mergedMountIds.includes(mount.mountId)) {
          continue;
        }
        const outcome = await env.getState().runAfterMergeCleanup({
          sessionId: facts.sessionId,
          mountId: mount.mountId,
          expectedBranch: mount.branch,
          mergedHeadSha: mount.mergedHeadSha,
          isRequested: true,
        });
        if (outcome.kind !== 'deleted') {
          refusals.push(cleanUpRefusalOf({ outcome, label: mount.label }));
        }
      }
      if (refusals.length > 0) {
        throw new Error(refusals.join(' '));
      }
    },
  },
];
