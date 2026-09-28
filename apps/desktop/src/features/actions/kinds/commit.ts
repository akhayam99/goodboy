import {
  ArrowDown,
  ArrowUp,
  Check,
  Combine,
  Copy,
  GitCommit,
  Hash,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { BranchCommit } from '@goodboy/types';
import { VERB_LINE } from '../../history/historyPlan';
import type { CommitActionTarget, ObjectKindDefinition } from '../types';

export type CommitFacts = {
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly older: ReadonlyArray<BranchCommit>;
  readonly onPick: () => void;
  readonly onReword: () => void;
  readonly onSquash: () => void;
  readonly onFold: (target: string) => void;
  readonly onDrop: () => void;
  readonly onMove: (direction: 'newer' | 'older') => void;
};

const NO_OLDER = 'No older commit below this one';

type FactsOnly = { readonly facts: CommitFacts };

const olderBlocked = ({ facts }: FactsOnly): string | null =>
  facts.older.length === 0 ? NO_OLDER : null;

export const COMMIT_KIND: ObjectKindDefinition<CommitActionTarget, CommitFacts> = {
  noun: 'commit',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'commit.pick',
      label: 'Pick',
      icon: Check,
      group: 'act',
      description: () => VERB_LINE.pick,
      when: () => true,
      run: ({ facts }) => facts.onPick(),
    },
    {
      id: 'commit.reword',
      label: 'Reword',
      icon: Pencil,
      group: 'act',
      description: () => VERB_LINE.reword,
      when: () => true,
      run: ({ facts }) => facts.onReword(),
    },
    {
      id: 'commit.squash',
      label: 'Squash into the one below',
      icon: Combine,
      group: 'act',
      description: () => VERB_LINE.squash,
      when: () => true,
      blockedReason: olderBlocked,
      run: ({ facts }) => facts.onSquash(),
    },
    {
      id: 'commit.fold',
      label: 'Fold into',
      icon: GitCommit,
      group: 'act',
      description: () => VERB_LINE.fixup,
      when: () => true,
      blockedReason: olderBlocked,
      choices: ({ facts }) =>
        facts.older.map((commit) => ({
          id: commit.sha,
          label: `${commit.shortSha} ${commit.subject}`,
          isCurrent: false,
        })),
      run: ({ facts, choice }) => {
        if (choice !== null) {
          facts.onFold(choice);
        }
      },
    },
    {
      id: 'commit.moveUp',
      label: 'Move up',
      icon: ArrowUp,
      group: 'act',
      description: () => VERB_LINE.move,
      when: () => true,
      run: ({ facts }) => facts.onMove('newer'),
    },
    {
      id: 'commit.moveDown',
      label: 'Move down',
      icon: ArrowDown,
      group: 'act',
      when: () => true,
      run: ({ facts }) => facts.onMove('older'),
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
      id: 'commit.drop',
      label: 'Drop',
      icon: Trash2,
      group: 'danger',
      description: () => VERB_LINE.drop,
      isUndoable: true,
      when: () => true,
      run: ({ facts }) => facts.onDrop(),
    },
  ],
};
