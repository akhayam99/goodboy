import { Copy, CopyPlus, Pencil, Play, Save, ScrollText, Square, Trash2 } from 'lucide-react';
import type { ObjectKindDefinition, ScriptActionTarget } from '../types';

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
