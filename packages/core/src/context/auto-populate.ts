import type { ContextSlot, SessionId } from '@goodboy/types';
import type { Database } from '@goodboy/db';
import { ContextEngine } from './engine';
import { extractMarkers, mergeIntoSlot, removeFromSlot } from './extractors';
import type { SlotKey } from './slots';

// Glue layer between turn output (files touched + assistant text markers)
// and the persistent ContextPanel slots. Called by the desktop store at the
// end of every turn. Thin on purpose: heavy logic lives in extractors.ts and
// ContextEngine; this fn orchestrates load → merge → upsert per slot.

export interface AutoPopulateInput {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly filesEdited: ReadonlyArray<string>;
  readonly assistantText: string;
}

export interface AutoPopulateResult {
  readonly updatedSlots: ReadonlyArray<SlotKey>;
}

export async function autoPopulateContext(input: AutoPopulateInput): Promise<AutoPopulateResult> {
  const engine = new ContextEngine({ db: input.db });
  const slots = await engine.load(input.sessionId);

  const { decisions, questions, resolved } = extractMarkers(input.assistantText);

  const updates: Array<{ key: SlotKey; value: string }> = [];

  pushUpdate(updates, slots, 'files_touched', input.filesEdited);
  pushUpdate(updates, slots, 'decisions', decisions);

  // open_questions: add new ones, then remove resolved. Compose against the
  // pending update if `pushUpdate` already staged one for this slot, so
  // resolutions and additions in the same turn don't fight each other.
  const existingQuestions = slots.find((s) => s.key === 'open_questions')?.value ?? '';
  let nextQuestions = mergeIntoSlot(existingQuestions, questions);
  nextQuestions = removeFromSlot(nextQuestions, resolved);
  if (nextQuestions !== existingQuestions) {
    updates.push({ key: 'open_questions', value: nextQuestions });
  }

  for (const upd of updates) {
    await engine.upsert(input.sessionId, upd.key, upd.value);
  }

  return { updatedSlots: updates.map((u) => u.key) };
}

function pushUpdate(
  updates: Array<{ key: SlotKey; value: string }>,
  slots: ReadonlyArray<ContextSlot>,
  key: SlotKey,
  additions: ReadonlyArray<string>,
): void {
  if (additions.length === 0) return;
  const existing = slots.find((s) => s.key === key)?.value ?? '';
  const merged = mergeIntoSlot(existing, additions);
  if (merged !== existing) {
    updates.push({ key, value: merged });
  }
}
