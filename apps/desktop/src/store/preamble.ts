import {
  isSlotKey,
  PREAMBLE_SLOT_TOTAL_BUDGET,
  PROVIDER_CAPABILITIES,
  serializeSlotsBudgeted,
  SLOT_KEYS,
  SLOT_LABELS,
  type SlotKey,
} from '@goodboy/core';
import type { ContextSlot, TurnEvent } from '@goodboy/types';
import { estimateTokens } from '../shared/utils/estimate-tokens';

const CONTEXT_MARKER_HINT =
  '## context handoff protocol\n' +
  'when you reach a durable design decision, wrap it as `<<ctx-decision>>your decision<</ctx-decision>>`.\n' +
  'when you have an open question that the user must answer before continuing, wrap it as `<<ctx-question>>your question<</ctx-question>>`. write the question in plain, self-contained language: the user has not read your reasoning, so spell out what you are asking and why it matters in one sentence. when the question is a bounded choice, offer 2 to 4 concrete options the user can pick in one tap via the `suggestions` attribute, pipe-separated. always include a `recommended` attribute with the single answer you would pick given the current context (match one of the suggestions verbatim when applicable), so the user can accept your default in one tap: `<<ctx-question suggestions="option a | option b | option c" recommended="option a">>your question<</ctx-question>>`.\n' +
  'when an open question listed in the shared context above has just been answered (by the user, or because work has clarified it), wrap it as `<<ctx-resolved>>the original question text<</ctx-resolved>>`, the orchestrator removes matching lines from open_questions. emit one resolved marker per question; reuse the original phrasing closely so the substring match succeeds.\n' +
  "the orchestrator parses these markers and persists them to this task's shared context panel, every other agent in this task will see them automatically. don't repeat what's already in the shared context above.";

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
  type Line = { role: 'user' | 'assistant'; text: string };
  const grouped: Line[] = [];
  let pendingAssistant = '';
  for (const ev of transcripts) {
    if (ev.kind === 'user_text') {
      if (pendingAssistant.length > 0) {
        grouped.push({ role: 'assistant', text: pendingAssistant });
        pendingAssistant = '';
      }
      grouped.push({ role: 'user', text: ev.text });
    } else if (ev.kind === 'assistant_text') {
      pendingAssistant += ev.delta;
    }
  }
  if (pendingAssistant.length > 0) {
    grouped.push({ role: 'assistant', text: pendingAssistant });
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
    const formatted = `${line.role}: ${text}`;
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
  for (const caps of Object.values(PROVIDER_CAPABILITIES)) {
    const m = caps.models.find((x) => x.id === model);
    if (m) {
      return m.contextWindow;
    }
  }
  return null;
};
