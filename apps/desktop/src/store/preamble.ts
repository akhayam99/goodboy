import { serializeSlots, type SlotKey, PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ContextSlot, TurnEvent } from '@goodboy/types';
import { estimateTokens } from '../shared/utils/estimate-tokens';

const CONTEXT_MARKER_HINT =
  '## context handoff protocol\n' +
  'when you reach a durable design decision, wrap it as `<<ctx-decision>>your decision<</ctx-decision>>`.\n' +
  'when you have an open question that the user must answer before continuing, wrap it as `<<ctx-question>>your question<</ctx-question>>`.\n' +
  'when an open question listed in the shared context above has just been answered (by the user, or because work has clarified it), wrap it as `<<ctx-resolved>>the original question text<</ctx-resolved>>` — the orchestrator removes matching lines from open_questions. emit one resolved marker per question; reuse the original phrasing closely so the substring match succeeds.\n' +
  "the orchestrator parses these markers and persists them to this task's shared context panel — every other agent in this task will see them automatically. don't repeat what's already in the shared context above.";

export function buildContextPreamble(
  sharedSlots: ReadonlyArray<ContextSlot>,
  slotFilter?: ReadonlyArray<SlotKey>,
): string {
  const parts: string[] = [];
  const filtered = slotFilter
    ? sharedSlots.filter((s) => (slotFilter as ReadonlyArray<string>).includes(s.key))
    : sharedSlots;
  const rendered = filtered.length > 0 ? serializeSlots(filtered) : '';
  if (rendered.length > 0) {
    parts.push(
      '## shared context (already loaded by orchestrator — do not re-derive)\n' + rendered,
    );
  }
  parts.push(CONTEXT_MARKER_HINT);
  return parts.join('\n\n');
}

const PRIOR_TURNS_HEADER = '## prior turns (this conversation, most recent last)';

// codex/cursor are stateless per-invocation. inject recent user/assistant text
// so they keep working memory. claude uses --resume (M1) so skip there.
export function buildPriorTurnsBlock(
  transcripts: ReadonlyArray<TurnEvent>,
  maxTokens: number,
): string {
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
  if (pendingAssistant.length > 0) grouped.push({ role: 'assistant', text: pendingAssistant });

  if (grouped.length === 0) return '';

  const kept: string[] = [];
  let budget = maxTokens;
  for (let i = grouped.length - 1; i >= 0; i--) {
    const line = grouped[i]!;
    const text = line.text.trim();
    if (text.length === 0) continue;
    const formatted = `${line.role}: ${text}`;
    const cost = estimateTokens(formatted);
    if (cost > budget) break;
    budget -= cost;
    kept.push(formatted);
  }
  if (kept.length === 0) return '';
  kept.reverse();
  return `${PRIOR_TURNS_HEADER}\n${kept.join('\n\n')}`;
}

export function getModelContextWindow(model: string): number | null {
  for (const caps of Object.values(PROVIDER_CAPABILITIES)) {
    const m = caps.models.find((x) => x.id === model);
    if (m) return m.contextWindow;
  }
  return null;
}
