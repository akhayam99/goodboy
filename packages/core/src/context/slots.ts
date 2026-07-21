import type { ContextSlot } from '@goodboy/types';
import { PREAMBLE_SLOT_TOTAL_BUDGET, SLOT_BUDGETS } from './budgets';

export const SLOT_KEYS = [
  'goal',
  'files_touched',
  'decisions',
  'open_questions',
  'last_output_summary',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

const SLOT_KEY_SET = new Set<string>(SLOT_KEYS);

export const SLOT_LABELS: Record<SlotKey, string> = {
  goal: 'goal',
  files_touched: 'files touched',
  decisions: 'decisions',
  open_questions: 'open questions',
  last_output_summary: 'session tldr',
};

const EMPTY_PLACEHOLDER = '·';
const COMPACTING_PLACEHOLDER = '- ...';
const OMITTED_PLACEHOLDER = '(omitted, over budget)';
const SLOT_PRIORITY = [
  'goal',
  'decisions',
  'last_output_summary',
  'open_questions',
  'files_touched',
] satisfies ReadonlyArray<SlotKey>;

export class InvalidSlotKeyError extends Error {
  constructor(public readonly key: string) {
    super(`unknown context slot key: ${key}`);
    this.name = 'InvalidSlotKeyError';
  }
}

export const isSlotKey = (key: string): key is SlotKey => {
  return SLOT_KEY_SET.has(key);
};

export const assertSlotKey: (key: string) => asserts key is SlotKey = (key) => {
  if (!isSlotKey(key)) {
    throw new InvalidSlotKeyError(key);
  }
};

export const serializeSlots = (slots: ReadonlyArray<ContextSlot>): string => {
  const byKey = new Map<SlotKey, ContextSlot>();
  for (const slot of slots) {
    if (isSlotKey(slot.key)) {
      byKey.set(slot.key, slot);
    }
  }

  const sections = SLOT_KEYS.map((key) => {
    const value = byKey.get(key)?.value.trim() ?? '';
    const body = value.length > 0 ? value : EMPTY_PLACEHOLDER;
    return `## ${SLOT_LABELS[key]}\n${body}`;
  });

  return sections.join('\n\n');
};

type Params = {
  readonly slots: ReadonlyArray<ContextSlot>;
};

type BudgetedSection = {
  readonly key: SlotKey;
  body: string;
};

export const serializeSlotsBudgeted = ({ slots }: Params): string => {
  const byKey = new Map<SlotKey, ContextSlot>();
  for (const slot of slots) {
    if (isSlotKey(slot.key)) {
      byKey.set(slot.key, slot);
    }
  }

  const sections: BudgetedSection[] = [];
  for (const key of SLOT_KEYS) {
    const value = byKey.get(key)?.value.trim() ?? '';
    const budget = SLOT_BUDGETS[key];
    if (value.length === 0) {
      sections.push({ key, body: EMPTY_PLACEHOLDER });
      continue;
    }
    if (value.length <= budget) {
      sections.push({ key, body: value });
      continue;
    }

    const lines = value.split('\n');
    const keptLines: string[] = [];
    if (key === 'files_touched') {
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index]!;
        const bodyLength = keptLines.join('\n').length;
        const candidateLength = line.length + (bodyLength > 0 ? bodyLength + 1 : 0);
        if (candidateLength + 1 + COMPACTING_PLACEHOLDER.length > budget) {
          break;
        }
        keptLines.unshift(line);
      }
    }
    if (key !== 'files_touched') {
      for (const line of lines) {
        const bodyLength = keptLines.join('\n').length;
        const candidateLength = bodyLength + (bodyLength > 0 ? 1 : 0) + line.length;
        if (candidateLength + 1 + COMPACTING_PLACEHOLDER.length > budget) {
          break;
        }
        keptLines.push(line);
      }
    }
    const body =
      keptLines.length > 0
        ? `${keptLines.join('\n')}\n${COMPACTING_PLACEHOLDER}`
        : COMPACTING_PLACEHOLDER;
    sections.push({ key, body });
  }

  let rendered = sections.map(({ key, body }) => `## ${SLOT_LABELS[key]}\n${body}`).join('\n\n');
  if (rendered.length <= PREAMBLE_SLOT_TOTAL_BUDGET) {
    return rendered;
  }

  for (const key of [...SLOT_PRIORITY].reverse()) {
    const section = sections.find((candidate) => candidate.key === key);
    if (section == null || section.body === EMPTY_PLACEHOLDER) {
      continue;
    }
    section.body = OMITTED_PLACEHOLDER;
    rendered = sections.map((item) => `## ${SLOT_LABELS[item.key]}\n${item.body}`).join('\n\n');
    if (rendered.length <= PREAMBLE_SLOT_TOTAL_BUDGET) {
      return rendered;
    }
  }

  return rendered;
};
