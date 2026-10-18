import { Copy, GitBranch, Trash2 } from 'lucide-react';
import { pluralize } from '../../../shared/utils/pluralize';
import type { BranchActionTarget, ObjectKindDefinition } from '../types';

export type BranchFacts = {
  readonly name: string;
  readonly isSafe: boolean;
  readonly unmergedCommits: number;
  readonly isBusy: boolean;
  readonly onOpenSession: (() => void) | null;
  readonly onDelete: () => Promise<void>;
};

const RESTORE_LINE = 'Kept for 14 days so you can restore it.';

export const BRANCH_KIND: ObjectKindDefinition<BranchActionTarget, BranchFacts> = {
  noun: 'branch',
  facts: ({ target }) => (target.facts.name === '' ? null : target.facts),
  actions: [
    {
      id: 'branch.openSession',
      label: 'Open session',
      icon: GitBranch,
      group: 'open',
      when: ({ facts }) => facts.onOpenSession !== null,
      run: ({ facts }) => facts.onOpenSession?.(),
    },
    {
      id: 'branch.copyName',
      label: 'Copy branch name',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.name }),
    },
    {
      id: 'branch.delete',
      label: 'Delete',
      icon: Trash2,
      group: 'danger',
      slot: () => 'hover',
      isUndoable: true,
      pendingLabel: () => 'Deleting',
      when: () => true,
      blockedReason: ({ facts }) => (facts.isBusy ? 'Another delete is running' : null),
      confirm: ({ facts }) =>
        facts.isSafe
          ? null
          : {
              title: `Delete ${facts.name}?`,
              description: RESTORE_LINE,
              confirmLabel:
                facts.unmergedCommits === 0
                  ? 'Delete'
                  : `Delete and ${pluralize(facts.unmergedCommits, 'commit')}`,
              role: 'danger',
              ...(facts.unmergedCommits > 0 && {
                notes: [`${pluralize(facts.unmergedCommits, 'commit')} not merged anywhere else.`],
              }),
            },
      run: async ({ facts }) => {
        await facts.onDelete();
      },
    },
  ],
};
