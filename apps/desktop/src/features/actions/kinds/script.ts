import {
  Copy,
  CopyPlus,
  Pencil,
  Pin,
  Play,
  RotateCw,
  Save,
  ScrollText,
  Square,
  Trash2,
} from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ObjectKindDefinition, ScriptActionTarget } from '../types';

type ScriptPinFacts = {
  readonly isPinned: boolean;
  readonly onToggle: () => void;
};

type ScriptAskFacts = {
  readonly label: string;
  readonly blockedReason: string | null;
  readonly onAsk: () => void;
};

export type ScriptFacts = {
  readonly name: string;
  readonly command: string;
  readonly isRunning: boolean;
  readonly runBlockedReason: string | null;
  readonly onShowOutput: () => void;
  readonly onRun: () => void;
  readonly onStop: () => void;
  readonly onEdit: (() => void) | null;
  readonly onDuplicate: (() => void) | null;
  readonly onSaveAs: (() => void) | null;
  readonly onDelete: (() => Promise<void>) | null;
  readonly onRestart?: () => void;
  readonly pin?: ScriptPinFacts;
  readonly ask?: ScriptAskFacts;
};

export const SCRIPT_KIND: ObjectKindDefinition<ScriptActionTarget, ScriptFacts> = {
  noun: 'script',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'script.output',
      label: 'Show output',
      icon: ScrollText,
      group: 'open',
      when: () => true,
      run: ({ facts }) => facts.onShowOutput(),
    },
    {
      id: 'script.askAgent',
      label: ({ facts }) => facts.ask?.label ?? 'Ask the agent about this',
      shortLabel: () => 'Ask',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      when: ({ facts }) => facts.ask !== undefined,
      blockedReason: ({ facts }) => facts.ask?.blockedReason ?? null,
      run: ({ facts }) => facts.ask?.onAsk(),
    },
    {
      id: 'script.run',
      label: 'Run',
      icon: Play,
      group: 'act',
      when: ({ facts }) => !facts.isRunning,
      blockedReason: ({ facts }) => facts.runBlockedReason,
      run: ({ facts }) => facts.onRun(),
    },
    {
      id: 'script.stop',
      label: 'Stop',
      icon: Square,
      group: 'act',
      when: ({ facts }) => facts.isRunning,
      run: ({ facts }) => facts.onStop(),
    },
    {
      id: 'script.restart',
      label: 'Restart',
      icon: RotateCw,
      group: 'act',
      when: ({ facts }) => facts.isRunning && facts.onRestart !== undefined,
      run: ({ facts }) => facts.onRestart?.(),
    },
    {
      id: 'script.pin',
      label: ({ facts }) => (facts.pin?.isPinned === true ? 'Unpin' : 'Pin'),
      icon: Pin,
      group: 'act',
      when: ({ facts }) => facts.pin !== undefined,
      run: ({ facts }) => facts.pin?.onToggle(),
    },
    {
      id: 'script.edit',
      label: 'Edit',
      icon: Pencil,
      group: 'act',
      when: ({ facts }) => facts.onEdit !== null,
      run: ({ facts }) => facts.onEdit?.(),
    },
    {
      id: 'script.duplicate',
      label: 'Duplicate',
      icon: CopyPlus,
      group: 'act',
      when: ({ facts }) => facts.onDuplicate !== null,
      run: ({ facts }) => facts.onDuplicate?.(),
    },
    {
      id: 'script.saveAs',
      label: 'Save as script',
      icon: Save,
      group: 'act',
      when: ({ facts }) => facts.onSaveAs !== null,
      run: ({ facts }) => facts.onSaveAs?.(),
    },
    {
      id: 'script.copyCommand',
      label: 'Copy command',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.command !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.command }),
    },
    {
      id: 'script.delete',
      label: 'Delete',
      icon: Trash2,
      group: 'danger',
      when: ({ facts }) => facts.onDelete !== null,
      confirm: ({ facts }) => ({
        title: `Delete "${facts.name}"?`,
        description: 'Removes it from every session of this workspace.',
        confirmLabel: 'Delete',
        role: 'danger',
      }),
      run: async ({ facts }) => {
        await facts.onDelete?.();
      },
    },
  ],
};
