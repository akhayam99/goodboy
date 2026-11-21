import { SquareArrowOutUpRight, FileText } from '@goodboy/ui/icons';
import type { DiffFileActionTarget, ObjectKindDefinition } from '../types';
import { VERBS } from '../../../shared/utils/verbs';

export type DiffFileFacts = {
  readonly path: string;
  readonly onOpenInEditor: (() => void) | null;
  readonly onShowWhole: (() => void) | null;
};

export const DIFF_FILE_KIND: ObjectKindDefinition<DiffFileActionTarget, DiffFileFacts> = {
  noun: 'file',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'diffFile.openInEditor',
      label: 'Open in editor',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: ({ facts }) => facts.onOpenInEditor !== null,
      run: ({ facts }) => facts.onOpenInEditor?.(),
    },
    {
      id: 'diffFile.showWhole',
      label: 'Show whole file',
      icon: FileText,
      group: 'act',
      when: ({ facts }) => facts.onShowWhole !== null,
      run: ({ facts }) => facts.onShowWhole?.(),
    },
    {
      id: 'diffFile.copyPath',
      ...VERBS.copyPath,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.path }),
    },
  ],
};
