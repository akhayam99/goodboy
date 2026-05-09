import type { ContextSlot, TaskId } from '@kay-am/types';
import type { Database } from '@kay-am/db';
import { ContextEngine } from './engine';
import { extractMarkers, mergeIntoSlot } from './extractors';
import type { SlotKey } from './slots';

// ---------------------------------------------------------------------------
// Glue layer between turn output (files touched + assistant text markers)
// and the persistent ContextPanel slots.
//
// Called by the desktop store at the end of every turn. Purposefully thin:
// the heavy logic lives in extractors.ts and ContextEngine; this fn only
// orchestrates load → merge → upsert per slot.
// ---------------------------------------------------------------------------

export interface AutoPopulateInput {
  readonly db: Database;
  readonly taskId: TaskId;
  readonly filesEdited: ReadonlyArray<string>;
  readonly assistantText: string;
}

export interface AutoPopulateResult {
  readonly updatedSlots: ReadonlyArray<SlotKey>;
}

export async function autoPopulateContext(input: AutoPopulateInput): Promise<AutoPopulateResult> {
  const engine = new ContextEngine({ db: input.db });
  const slots = await engine.load(input.taskId);

  const { decisions, questions } = extractMarkers(input.assistantText);

  const updates: Array<{ key: SlotKey; value: string }> = [];

  pushUpdate(updates, slots, 'files_touched', input.filesEdited);
  pushUpdate(updates, slots, 'decisions', decisions);
  pushUpdate(updates, slots, 'open_questions', questions);

  for (const upd of updates) {
    await engine.upsert(input.taskId, upd.key, upd.value);
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
