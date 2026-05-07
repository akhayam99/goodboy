import type { ContextSlot } from '@kay-am/types';

export const SLOT_KEYS = [
  'goal',
  'files_touched',
  'decisions',
  'open_questions',
  'last_output_summary',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

const SLOT_KEY_SET = new Set<string>(SLOT_KEYS);

const SLOT_LABELS: Record<SlotKey, string> = {
  goal: 'goal',
  files_touched: 'files touched',
  decisions: 'decisions',
  open_questions: 'open questions',
  last_output_summary: 'last output summary',
};

const EMPTY_PLACEHOLDER = '—';

export class InvalidSlotKeyError extends Error {
  constructor(public readonly key: string) {
    super(`unknown context slot key: ${key}`);
    this.name = 'InvalidSlotKeyError';
  }
}

export function isSlotKey(key: string): key is SlotKey {
  return SLOT_KEY_SET.has(key);
}

export function assertSlotKey(key: string): asserts key is SlotKey {
  if (!isSlotKey(key)) throw new InvalidSlotKeyError(key);
}

export function serializeSlots(slots: ReadonlyArray<ContextSlot>): string {
  const byKey = new Map<SlotKey, ContextSlot>();
  for (const slot of slots) {
    if (isSlotKey(slot.key) && slot.enabled) {
      byKey.set(slot.key, slot);
    }
  }

  const sections = SLOT_KEYS.map((key) => {
    const value = byKey.get(key)?.value.trim() ?? '';
    const body = value.length > 0 ? value : EMPTY_PLACEHOLDER;
    return `## ${SLOT_LABELS[key]}\n${body}`;
  });

  return sections.join('\n\n');
}
