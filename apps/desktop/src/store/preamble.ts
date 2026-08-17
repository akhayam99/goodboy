import {
  isSlotKey,
  PREAMBLE_SLOT_TOTAL_BUDGET,
  serializeSlotsBudgeted,
  SLOT_KEYS,
  SLOT_LABELS,
  type SlotKey,
} from '@goodboy/core';
import type { ContextSlot, TurnEvent } from '@goodboy/types';
import { contextWindowFor } from '../features/session/contextWindowFor';
import { estimateTokens } from '../shared/utils/estimate-tokens';

const CONTEXT_MARKER_HINT =
  '## context handoff protocol (parsed into the shared context above, seen by every agent, never repeat what is already there)\n' +
  '`<<ctx-decision>>durable decision<</ctx-decision>>`. `<<ctx-resolved>>original question text, quoted closely<</ctx-resolved>>` once an open question above is answered, one per question.\n' +
  '`<<ctx-question suggestions="a | b | c" recommended="a" select="one">>question<</ctx-question>>` when the user must answer first: self-contained, what and why in one sentence; `suggestions` = 2 to 4 pipe-separated options when bounded; `recommended` always set, verbatim from suggestions when present; `select="one"` (default, radio) when exactly one option applies, `select="many"` (checkbox) when the user can combine several. A free-text answer stays available in both modes.';

export const buildContextPreamble = (
  sharedSlots: ReadonlyArray<ContextSlot>,
  slotFilter?: ReadonlyArray<SlotKey>,
): string => {
  const parts: string[] = [];
  const enabledSlots = sharedSlots.filter((slot) => slot.enabled !== false);
  const filtered = slotFilter
    ? enabledSlots.filter((slot) => (slotFilter as ReadonlyArray<string>).includes(slot.key))
    : enabledSlots;
  const rendered = filtered.length > 0 ? serializeSlotsBudgeted({ slots: filtered }) : '';
  if (import.meta.env.DEV && rendered.length > PREAMBLE_SLOT_TOTAL_BUDGET * 0.8) {
    const byKey = new Map<SlotKey, ContextSlot>();
    for (const slot of filtered) {
      if (isSlotKey(slot.key)) {
        byKey.set(slot.key, slot);
      }
    }
    const emptySerialized = serializeSlotsBudgeted({ slots: [] });
    const slotChars: Record<SlotKey, number> = {
      goal: 0,
      files_touched: 0,
      decisions: 0,
      open_questions: 0,
      last_output_summary: 0,
    };
    for (const key of SLOT_KEYS) {
      const emptySection = `## ${SLOT_LABELS[key]}\n·`;
      const omittedSection = `## ${SLOT_LABELS[key]}\n(omitted, over budget)`;
      if (rendered.includes(omittedSection)) {
        slotChars[key] = omittedSection.length;
        continue;
      }
      const slot = byKey.get(key);
      const isolated = serializeSlotsBudgeted({ slots: slot == null ? [] : [slot] });
      slotChars[key] = emptySection.length + isolated.length - emptySerialized.length;
    }
    console.debug('[context-preamble] serialized slot budget usage', {
      totalChars: rendered.length,
      slotChars,
    });
  }
  if (rendered.length > 0) {
    parts.push('## shared context (already loaded by orchestrator, do not re-derive)\n' + rendered);
  }
  parts.push(CONTEXT_MARKER_HINT);
  return parts.join('\n\n');
};

const PRIOR_TURNS_HEADER = '## prior turns (this conversation, most recent last)';

export const buildPriorTurnsBlock = (
  transcripts: ReadonlyArray<TurnEvent>,
  maxTokens: number,
): string => {
  type Line = { label: 'user' | 'assistant' | 'workflow handoff (carried forward)'; text: string };
  const grouped: Line[] = [];
  let pendingAssistant = '';
  for (const ev of transcripts) {
    if (ev.kind === 'user_text') {
      if (pendingAssistant.length > 0) {
        grouped.push({ label: 'assistant', text: pendingAssistant });
        pendingAssistant = '';
      }
      grouped.push({ label: 'user', text: ev.text });
      continue;
    }
    if (ev.kind === 'assistant_text') {
      pendingAssistant += ev.delta;
      continue;
    }
    if (ev.kind === 'step_transition') {
      if (pendingAssistant.length > 0) {
        grouped.push({ label: 'assistant', text: pendingAssistant });
        pendingAssistant = '';
      }
      grouped.push({
        label: 'workflow handoff (carried forward)',
        text: ev.carryForwardContext,
      });
    }
  }
  if (pendingAssistant.length > 0) {
    grouped.push({ label: 'assistant', text: pendingAssistant });
  }

  if (grouped.length === 0) {
    return '';
  }

  const kept: string[] = [];
  let budget = maxTokens;
  for (let i = grouped.length - 1; i >= 0; i--) {
    const line = grouped[i]!;
    const text = line.text.trim();
    if (text.length === 0) {
      continue;
    }
    const formatted = `${line.label}: ${text}`;
    const cost = estimateTokens(formatted);
    if (cost > budget) {
      break;
    }
    budget -= cost;
    kept.push(formatted);
  }
  if (kept.length === 0) {
    return '';
  }
  kept.reverse();
  return `${PRIOR_TURNS_HEADER}\n${kept.join('\n\n')}`;
};

export const getModelContextWindow = (model: string): number | null => {
  return contextWindowFor(model);
};
