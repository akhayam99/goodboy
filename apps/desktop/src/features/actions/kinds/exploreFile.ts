import { Copy, ExternalLink, FolderOpen } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ExploreFileActionTarget, ObjectKindDefinition } from '../types';

export type ExploreFileFacts = {
  readonly name: string;
  readonly relPath: string;
  readonly absolutePath: string;
  readonly isDir: boolean;
  readonly openLabel: 'Open in editor' | 'Open' | null;
  readonly editorLabel: string | null;
  readonly onAsk: (() => void) | null;
  readonly onOpen: (() => void) | null;
  readonly onReveal: (() => void) | null;
};

export const EXPLORE_FILE_KIND: ObjectKindDefinition<ExploreFileActionTarget, ExploreFileFacts> = {
  noun: 'file',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'exploreFile.openInEditor',
      label: ({ facts }) => facts.openLabel ?? 'Open',
      icon: ExternalLink,
      group: 'open',
      slot: () => 'hover',
      description: ({ facts }) =>
        facts.editorLabel === null ? 'Open with the default app' : `Open in ${facts.editorLabel}`,
      when: ({ facts }) => facts.openLabel !== null && facts.onOpen !== null,
      run: ({ facts }) => facts.onOpen?.(),
    },
    {
      id: 'exploreFile.reveal',
      label: 'Show in Finder',
      icon: FolderOpen,
      group: 'open',
      slot: () => 'hover',
      when: ({ facts }) => facts.onReveal !== null,
      run: ({ facts }) => facts.onReveal?.(),
    },
    {
      id: 'exploreFile.ask',
      label: 'Ask an agent about this file',
      shortLabel: () => 'Ask an agent',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      slot: () => 'hover',
      when: ({ facts }) => !facts.isDir && facts.onAsk !== null,
      run: ({ facts }) => facts.onAsk?.(),
    },
    {
      id: 'exploreFile.copyPath',
      label: 'Copy path',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.absolutePath }),
    },
  ],
};
