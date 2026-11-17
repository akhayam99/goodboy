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
} from '@goodboy/ui/icons';
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

const NOTHING_BELOW = 'No commit below';
const SEPARATE_FIRST = 'Separate the commits squashed into it first';

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
      label: 'Reword',
      icon: PenLine,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Edit the commit message · R',
      when: isStanding,
      run: ({ facts }) => facts.onRename(),
    },
    {
      id: 'commit.foldDown',
      label: 'Fixup down',
      icon: GitMerge,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Fixup into the commit below, drop this message · C',
      when: isStanding,
      blockedReason: belowBlocked,
      run: ({ facts }) => facts.onFoldDown(),
    },
    {
      id: 'commit.squashDown',
      label: 'Squash down',
      icon: Combine,
      group: 'act',
      description: () => 'Squash into the commit below, keep both messages · S',
      when: isStanding,
      blockedReason: belowBlocked,
      run: ({ facts }) => facts.onSquashDown(),
    },
    {
      id: 'commit.separate',
      label: 'Separate commit',
      icon: Undo2,
      group: 'act',
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
      label: 'Keep commit',
      icon: Undo2,
      group: 'act',
      slot: () => 'hover',
      description: () => 'Undo the drop',
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
      label: 'Drop commit',
      icon: Trash2,
      group: 'danger',
      slot: () => 'hover',
      description: () => 'Drop it from the branch · Delete',
      isUndoable: true,
      when: ({ facts }) => !facts.isFolded && !facts.isRemoved,
      blockedReason: ({ facts }) => (facts.canRemove ? null : SEPARATE_FIRST),
      run: ({ facts }) => facts.onToggleRemove(),
    },
  ],
};
