import { Copy, ExternalLink, MessageSquarePlus } from 'lucide-react';
import type { DiffFileActionTarget, ObjectKindDefinition } from '../types';

export type DiffFileFacts = {
  readonly path: string;
  readonly onOpenInEditor: (() => void) | null;
  readonly onCommentOnFile: (() => void) | null;
};

export const DIFF_FILE_KIND: ObjectKindDefinition<DiffFileActionTarget, DiffFileFacts> = {
  noun: 'file',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'diffFile.openInEditor',
      label: 'Open in editor',
      icon: ExternalLink,
      group: 'open',
      when: ({ facts }) => facts.onOpenInEditor !== null,
      run: ({ facts }) => facts.onOpenInEditor?.(),
    },
    {
      id: 'diffFile.comment',
      label: 'Comment on file',
      icon: MessageSquarePlus,
      group: 'act',
      when: ({ facts }) => facts.onCommentOnFile !== null,
      run: ({ facts }) => facts.onCommentOnFile?.(),
    },
    {
      id: 'diffFile.copyPath',
      label: 'Copy path',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.path }),
    },
  ],
};
