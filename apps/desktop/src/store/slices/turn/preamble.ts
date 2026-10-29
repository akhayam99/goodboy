import {
  DECISION_FIRST_RULE,
  isSlotKey,
  PREAMBLE_SLOT_TOTAL_BUDGET,
  serializeSlotsBudgeted,
  SLOT_KEYS,
  SLOT_LABELS,
  type SlotKey,
} from '@goodboy/core';
import type { ContextSlot, SessionContextItem, TurnEvent } from '@goodboy/types';
import { contextWindowFor } from '../../../features/session/contextWindowFor';
import { estimateTokens } from '../../../shared/utils/estimate-tokens';

const CONTEXT_MARKER_HINT =
  '## context handoff protocol (parsed into the shared context above, seen by every agent, never repeat what is already there)\n' +
  'Decisions above carry a number (`D7`). `<<ctx-decision>>durable decision<</ctx-decision>>` adds one; `<<ctx-decision replaces="D3">>the newer decision<</ctx-decision>>` replaces D3; `<<ctx-decision withdraw="D5">>why it no longer holds<</ctx-decision>>` withdraws D5. A decision you do not name stays. `<<ctx-resolved>>original question text, quoted closely<</ctx-resolved>>` once an open question above is answered, one per question.\n' +
  '`<<ctx-question suggestions="a | b | c" recommended="a" select="one">>question<</ctx-question>>` (the opening tag ends with exactly two angle brackets, `>>`, and the block closes with `<</ctx-question>>`) when the user must answer first: self-contained, what and why in one sentence; `suggestions` = 2 to 4 pipe-separated options when bounded; `recommended` always set, verbatim from suggestions when present; `select="one"` (default, radio) when exactly one option applies, `select="many"` (checkbox) when the user can combine several. A free-text answer stays available in both modes. Add `blocking="true"` only when the answer changes WHAT the output says and cannot be settled from the available material, for example when the goal has two readings that produce different results, two sources contradict each other, or something is needed that only a person has. A preference with a defensible default is never blocking: answer it yourself and record the assumption.\n' +
  DECISION_FIRST_RULE;

export const buildContextPreamble = (
  sharedSlots: ReadonlyArray<ContextSlot>,
  slotFilter?: ReadonlyArray<SlotKey>,
  contextItems: ReadonlyArray<SessionContextItem> = [],
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
  if (contextItems.length > 0) {
    parts.push(
      [
        '## notes for your role',
        ...contextItems.map((item) => `- ${item.title}: ${item.text}`),
      ].join('\n'),
    );
  }
  parts.push(CONTEXT_MARKER_HINT);
  return parts.join('\n\n');
};

const PRIOR_TURNS_HEADER = '## prior turns (this conversation, most recent last)';

export const PRIOR_TURNS_BUDGET_TOKENS = 8000;

const PINNED_REQUEST_SHARE = 0.25;
const CHARS_PER_TOKEN = 4;
const MARKER_ROOM_CHARS = 60;
const MIN_KEPT_CHARS = 40;

type PriorTurnLabel = 'user' | 'assistant' | 'workflow handoff (carried forward)';

type PriorTurnLine = {
  readonly label: PriorTurnLabel;
  readonly text: string;
};

type PriorTurnsParams = {
  readonly transcripts: ReadonlyArray<TurnEvent>;
  readonly maxTokens: number;
};

type LineParams = {
  readonly line: PriorTurnLine;
};

type TranscriptParams = {
  readonly transcripts: ReadonlyArray<TurnEvent>;
};

type ShortenParams = {
  readonly line: PriorTurnLine;
  readonly maxTokens: number;
};

export type PriorTurns = {
  readonly text: string;
  readonly carried: number;
  readonly leftOut: number;
  readonly isShortened: boolean;
};

const NO_PRIOR_TURNS: PriorTurns = { text: '', carried: 0, leftOut: 0, isShortened: false };

const formatLine = ({ line }: LineParams): string => `${line.label}: ${line.text}`;

const shorten = ({ line, maxTokens }: ShortenParams): string | null => {
  const roomChars = maxTokens * CHARS_PER_TOKEN - line.label.length - 2 - MARKER_ROOM_CHARS;
  if (roomChars < MIN_KEPT_CHARS) {
    return null;
  }
  const cut = line.text.slice(0, roomChars);
  return `${line.label}: ${cut}\n[shortened: ${line.text.length - cut.length} characters left out]`;
};

const groupPriorTurns = ({ transcripts }: TranscriptParams): ReadonlyArray<PriorTurnLine> => {
  const grouped: PriorTurnLine[] = [];
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
  return grouped
    .map((line) => ({ label: line.label, text: line.text.trim() }))
    .filter((line) => line.text.length > 0);
};

export const buildPriorTurnsBlock = ({ transcripts, maxTokens }: PriorTurnsParams): PriorTurns => {
  const lines = groupPriorTurns({ transcripts });
  if (lines.length === 0) {
    return NO_PRIOR_TURNS;
  }

  const firstUser = lines.findIndex((line) => line.label === 'user');
  const pinnedLine = firstUser >= 0 && firstUser < lines.length - 1 ? lines[firstUser]! : null;
  const pinnedWhole = pinnedLine === null ? null : formatLine({ line: pinnedLine });
  const pinnedShare = Math.floor(maxTokens * PINNED_REQUEST_SHARE);
  const pinned =
    pinnedLine === null || pinnedWhole === null
      ? null
      : estimateTokens(pinnedWhole) <= pinnedShare
        ? pinnedWhole
        : shorten({ line: pinnedLine, maxTokens: pinnedShare });
  const isPinnedShortened = pinned !== null && pinned !== pinnedWhole;

  const kept: string[] = [];
  let isShortened = isPinnedShortened;
  let budget = maxTokens - (pinned === null ? 0 : estimateTokens(pinned));
  const oldestWalked = pinned === null ? 0 : firstUser + 1;
  for (let i = lines.length - 1; i >= oldestWalked; i--) {
    const line = lines[i]!;
    const formatted = formatLine({ line });
    const cost = estimateTokens(formatted);
    if (cost > budget) {
      const cut = i === lines.length - 1 ? shorten({ line, maxTokens: budget }) : null;
      if (cut !== null) {
        kept.push(cut);
        isShortened = true;
      }
      break;
    }
    budget -= cost;
    kept.push(formatted);
  }
  const carried = kept.length + (pinned === null ? 0 : 1);
  if (carried === 0) {
    return { ...NO_PRIOR_TURNS, leftOut: lines.length };
  }
  kept.reverse();
  const leftOut = lines.length - carried;
  const gap = leftOut > 0 ? [`[${leftOut} older turns left out]`] : [];
  const parts = [...(pinned === null ? [] : [pinned]), ...gap, ...kept];
  return {
    text: `${PRIOR_TURNS_HEADER}\n${parts.join('\n\n')}`,
    carried,
    leftOut,
    isShortened,
  };
};

export const getModelContextWindow = (model: string): number | null => {
  return contextWindowFor(model);
};
