import { Copy, ExternalLink, FileText, PanelRight } from 'lucide-react';
import type { DiffFileActionTarget, ObjectKindDefinition } from '../types';

export type DiffFileFacts = {
  readonly path: string;
  readonly onOpenInEditor: (() => void) | null;
  readonly onShowWhole: (() => void) | null;
  readonly onOpenInDrawer: (() => void) | null;
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
      id: 'diffFile.openInDrawer',
      label: 'Open in a drawer',
      icon: PanelRight,
      group: 'open',
      when: ({ facts }) => facts.onOpenInDrawer !== null,
      run: ({ facts }) => facts.onOpenInDrawer?.(),
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
      label: 'Copy path',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.path }),
    },
  ],
};
