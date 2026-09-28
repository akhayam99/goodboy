import { Bookmark, Clock, Code, Copy, FolderOpen, Trash2 } from 'lucide-react';
import type { ObjectKindDefinition, WorktreeActionTarget } from '../types';

export const KEEP_DAYS = 30;

export type WorktreeRemoveIntent = 'force' | 'untracked';

export type WorktreeFacts = {
  readonly path: string;
  readonly isInUse: boolean;
  readonly isKept: boolean;
  readonly removeIntent: WorktreeRemoveIntent | null;
  readonly onReveal: () => void;
  readonly onEditor: () => void;
  readonly onKeep: (days: number | null) => void;
  readonly onStopKeeping: () => void;
  readonly onRemove: (intent: WorktreeRemoveIntent) => void;
};

type FactsOnly = { readonly facts: WorktreeFacts };

const canKeep = ({ facts }: FactsOnly): boolean => !facts.isInUse && !facts.isKept;

export const WORKTREE_KIND: ObjectKindDefinition<WorktreeActionTarget, WorktreeFacts> = {
  noun: 'worktree',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'worktree.reveal',
      label: 'Show in Finder',
      icon: FolderOpen,
      group: 'open',
      when: () => true,
      run: ({ facts }) => facts.onReveal(),
    },
    {
      id: 'worktree.editor',
      label: 'Open in editor',
      icon: Code,
      group: 'open',
      when: () => true,
      run: ({ facts }) => facts.onEditor(),
    },
    {
      id: 'worktree.keepDays',
      label: `Keep for ${KEEP_DAYS} days`,
      icon: Clock,
      group: 'act',
      when: canKeep,
      run: ({ facts }) => facts.onKeep(KEEP_DAYS),
    },
    {
      id: 'worktree.keep',
      label: 'Keep',
      icon: Bookmark,
      group: 'act',
      when: canKeep,
      run: ({ facts }) => facts.onKeep(null),
    },
    {
      id: 'worktree.stopKeeping',
      label: 'Stop keeping',
      icon: Bookmark,
      group: 'act',
      when: ({ facts }) => !facts.isInUse && facts.isKept,
      run: ({ facts }) => facts.onStopKeeping(),
    },
    {
      id: 'worktree.copyPath',
      label: 'Copy path',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.path }),
    },
    {
      id: 'worktree.remove',
      label: ({ facts }) => (facts.removeIntent === 'force' ? 'Remove anyway' : 'Remove'),
      icon: Trash2,
      group: 'danger',
      hasCustomConfirm: true,
      description: ({ facts }) =>
        facts.removeIntent === 'untracked' ? "Goodboy can't check this folder for changes" : null,
      when: ({ facts }) => facts.removeIntent !== null,
      run: ({ facts }) => {
        if (facts.removeIntent !== null) {
          facts.onRemove(facts.removeIntent);
        }
      },
    },
  ],
};
