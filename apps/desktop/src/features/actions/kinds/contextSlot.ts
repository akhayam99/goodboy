import { Eye, History, Pencil } from 'lucide-react';
import type { ContextSlotActionTarget, ObjectKindDefinition } from '../types';

export type ContextSlotFacts = {
  readonly isLocked: boolean;
  readonly hasVersions: boolean;
  readonly onEdit: () => void;
  readonly onOpenVersions: () => void;
  readonly onToggleVisibility: () => void;
};

export const CONTEXT_SLOT_KIND: ObjectKindDefinition<ContextSlotActionTarget, ContextSlotFacts> = {
  noun: 'context section',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'contextSlot.edit',
      label: 'Edit',
      icon: Pencil,
      group: 'act',
      blockedReason: ({ facts }) =>
        facts.isLocked ? 'Editing opens when the update finishes' : null,
      when: () => true,
      run: ({ facts }) => {
        if (facts.isLocked) {
          return 'unchanged';
        }
        facts.onEdit();
        return 'done';
      },
    },
    {
      id: 'contextSlot.versions',
      label: 'Versions',
      icon: History,
      group: 'act',
      blockedReason: ({ facts }) => (facts.hasVersions ? null : 'No earlier versions yet'),
      when: () => true,
      run: ({ facts }) => {
        if (!facts.hasVersions) {
          return 'unchanged';
        }
        facts.onOpenVersions();
        return 'done';
      },
    },
    {
      id: 'contextSlot.visibility',
      label: 'Who reads this',
      icon: Eye,
      group: 'act',
      when: () => true,
      run: ({ facts }) => {
        facts.onToggleVisibility();
        return 'done';
      },
    },
  ],
};
