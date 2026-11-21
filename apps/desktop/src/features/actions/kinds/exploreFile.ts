import { SquareArrowOutUpRight, FolderOpen } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openInConfiguredTerminal } from '../../../shared/lib/terminalApp';
import { revealLabelOf } from '../../../shared/utils/revealLabelOf';
import type { ExploreFileActionTarget, ObjectKindDefinition } from '../types';
import { RUN_ROUTE_COPY } from '../../session/startRun/runRouteCopy';
import { VERBS, openInEditorLabelOf } from '../../../shared/utils/verbs';

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
      icon: SquareArrowOutUpRight,
      group: 'open',
      slot: () => 'hover',
      description: ({ facts }) =>
        facts.editorLabel === null
          ? 'Open with the default app'
          : openInEditorLabelOf({ editorLabel: facts.editorLabel }),
      when: ({ facts }) => facts.openLabel !== null && facts.onOpen !== null,
      run: ({ facts }) => facts.onOpen?.(),
    },
    {
      id: 'exploreFile.openInTerminalApp',
      ...VERBS.openInExternalTerminal,
      group: 'open',
      when: ({ facts }) => facts.isDir,
      run: ({ facts, env }) =>
        openInConfiguredTerminal({ path: facts.absolutePath, state: env.getState() }),
    },
    {
      id: 'exploreFile.reveal',
      label: () => revealLabelOf(),
      icon: FolderOpen,
      group: 'open',
      slot: () => 'hover',
      when: ({ facts }) => facts.onReveal !== null,
      run: ({ facts }) => facts.onReveal?.(),
    },
    {
      id: 'exploreFile.ask',
      label: RUN_ROUTE_COPY.askAboutFile,
      shortLabel: () => 'Ask',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      slot: () => 'hover',
      when: ({ facts }) => !facts.isDir && facts.onAsk !== null,
      run: ({ facts }) => facts.onAsk?.(),
    },
    {
      id: 'exploreFile.copyPath',
      ...VERBS.copyPath,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.absolutePath }),
    },
  ],
};
