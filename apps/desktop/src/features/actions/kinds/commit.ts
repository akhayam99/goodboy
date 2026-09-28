import {
  ArrowDown,
  ArrowUp,
  Combine,
  Copy,
  GitMerge,
  Hash,
  PenLine,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { CommitActionTarget, ObjectKindDefinition } from '../types';

export type CommitFacts = {
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly isFolded: boolean;
  readonly isRemoved: boolean;
  readonly canRemove: boolean;
  readonly canFoldDown: boolean;
  readonly onRename: () => void;
  readonly onFoldDown: () => void;
  readonly onSquashDown: () => void;
  readonly onToggleRemove: () => void;
  readonly onSeparate: () => void;
  readonly onMove: (direction: 'newer' | 'older') => void;
};

const NOTHING_BELOW = 'Nothing below to combine with';
const SEPARATE_FIRST = 'Separate what it takes in first';

type FactsOnly = { readonly facts: CommitFacts };

const isStanding = ({ facts }: FactsOnly): boolean => !facts.isFolded;

const belowBlocked = ({ facts }: FactsOnly): string | null =>
  facts.canFoldDown ? null : NOTHING_BELOW;

export const COMMIT_KIND: ObjectKindDefinition<CommitActionTarget, CommitFacts> = {
  noun: 'commit',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'commit.rename',
      label: 'Rename',
      icon: PenLine,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Rename (reword) · R',
      when: isStanding,
      run: ({ facts }) => facts.onRename(),
    },
    {
      id: 'commit.foldDown',
      label: 'Fold down',
      icon: GitMerge,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Fold into the one below, keeping its title (fixup) · C',
      when: isStanding,
      blockedReason: belowBlocked,
      run: ({ facts }) => facts.onFoldDown(),
    },
    {
      id: 'commit.squashDown',
      label: 'Squash down',
      icon: Combine,
      group: 'act',
      description: () => 'Combine with the one below, keeping both messages (squash) · S',
      when: isStanding,
      blockedReason: belowBlocked,
      run: ({ facts }) => facts.onSquashDown(),
    },
    {
      id: 'commit.separate',
      label: 'Separate',
      icon: Undo2,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Make it its own commit again',
      when: ({ facts }) => facts.isFolded,
      run: ({ facts }) => facts.onSeparate(),
    },
    {
      id: 'commit.moveUp',
      label: 'Move up',
      icon: ArrowUp,
      group: 'act',
      description: () => 'Move it one place newer · Alt+Up',
      when: isStanding,
      run: ({ facts }) => facts.onMove('newer'),
    },
    {
      id: 'commit.moveDown',
      label: 'Move down',
      icon: ArrowDown,
      group: 'act',
      description: () => 'Move it one place older · Alt+Down',
      when: isStanding,
      run: ({ facts }) => facts.onMove('older'),
    },
    {
      id: 'commit.keep',
      label: 'Keep',
      icon: Undo2,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Keep it',
      when: ({ facts }) => facts.isRemoved,
      run: ({ facts }) => facts.onToggleRemove(),
    },
    {
      id: 'commit.copySha',
      label: 'Copy SHA',
      icon: Hash,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.sha }),
    },
    {
      id: 'commit.copySubject',
      label: 'Copy subject',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.subject !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.subject }),
    },
    {
      id: 'commit.remove',
      label: 'Remove',
      icon: Trash2,
      group: 'danger',
      slot: () => 'hover',
      description: () => 'Remove (drop) · Delete',
      isUndoable: true,
      when: ({ facts }) => !facts.isFolded && !facts.isRemoved,
      blockedReason: ({ facts }) => (facts.canRemove ? null : SEPARATE_FIRST),
      run: ({ facts }) => facts.onToggleRemove(),
    },
  ],
};
