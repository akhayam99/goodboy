import type {
  AgentId,
  ContextSlot,
  OpenQuestionId,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  insertOpenQuestion,
  listResolvedQuestionTextsForSession,
  markOpenQuestionsResolvedByText,
  type Database,
} from '@goodboy/db';
import { ContextEngine } from './engine';
import { extractMarkers, mergeIntoSlot, removeFromSlot } from './extractors';
import type { SlotKey } from './slots';

// Glue layer between turn output (files touched + assistant text markers)
// and the persistent ContextPanel slots. Called by the desktop store at the
// end of every turn. Thin on purpose: heavy logic lives in extractors.ts and
// ContextEngine; this fn orchestrates load → merge → upsert per slot.

// Provenance of the agent that produced the turn whose markers we're about
// to persist. Used to stamp open_questions with their creator so the UI can
// cluster them per-agent and route answers back to the right chat. The
// store resolves this from `activeAgentId` + workflow templates before
// invoking auto-populate.
export interface AgentContext {
  readonly agentId: AgentId;
  readonly workflowId?: WorkflowId;
  readonly workflowRunId?: WorkflowRunId;
  readonly stepOrdinal?: number;
}

export interface AutoPopulateInput {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly filesEdited: ReadonlyArray<string>;
  readonly assistantText: string;
  readonly agentContext?: AgentContext;
}

export interface AutoPopulateResult {
  readonly updatedSlots: ReadonlyArray<SlotKey>;
  readonly openQuestionsChanged: boolean;
}

export async function autoPopulateContext(input: AutoPopulateInput): Promise<AutoPopulateResult> {
  const engine = new ContextEngine({ db: input.db });
  const slots = await engine.load(input.sessionId);

  const { decisions, questions, resolved } = extractMarkers(input.assistantText);

  const resolvedTexts = await listResolvedQuestionTextsForSession(input.db, input.sessionId);
  const freshQuestions = questions.filter((q) => !matchesAny(q.text, resolvedTexts));

  const updates: Array<{ key: SlotKey; value: string }> = [];

  pushUpdate(updates, slots, 'files_touched', input.filesEdited);
  pushUpdate(updates, slots, 'decisions', decisions);

  // open_questions: add new ones, then remove resolved. Compose against the
  // pending update if `pushUpdate` already staged one for this slot, so
  // resolutions and additions in the same turn don't fight each other.
  const existingQuestions = slots.find((s) => s.key === 'open_questions')?.value ?? '';
  let nextQuestions = mergeIntoSlot(
    existingQuestions,
    freshQuestions.map((q) => q.text),
  );
  nextQuestions = removeFromSlot(nextQuestions, resolved);
  if (nextQuestions !== existingQuestions) {
    updates.push({ key: 'open_questions', value: nextQuestions });
  }

  for (const upd of updates) {
    await engine.upsert(input.sessionId, upd.key, upd.value);
  }

  // Persist questions to the dedicated `open_questions` table so the Questions
  // tab can render gamified per-question cards with suggestion chips. Dedup is
  // enforced by a partial unique index `(session_id, text) WHERE status='open'`;
  // re-emitting the same question across turns is a no-op.
  let insertedCount = 0;
  for (const q of freshQuestions) {
    const res = await insertOpenQuestion(input.db, {
      id: cryptoRandomUUID() as OpenQuestionId,
      sessionId: input.sessionId,
      workflowId: input.agentContext?.workflowId,
      workflowRunId: input.agentContext?.workflowRunId,
      createdByStepOrdinal: input.agentContext?.stepOrdinal,
      ownedByStepOrdinal: input.agentContext?.stepOrdinal,
      createdByAgentId: input.agentContext?.agentId,
      text: q.text,
      suggestedAnswers: q.suggestedAnswers,
    });
    if (res.inserted) insertedCount += 1;
  }

  const resolvedCount = await markOpenQuestionsResolvedByText(input.db, input.sessionId, resolved);

  return {
    updatedSlots: updates.map((u) => u.key),
    openQuestionsChanged: insertedCount > 0 || resolvedCount > 0,
  };
}

function normalizeQuestion(s: string): string {
  return s
    .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
    .trim()
    .toLowerCase();
}

function matchesAny(text: string, candidates: ReadonlyArray<string>): boolean {
  const n = normalizeQuestion(text);
  if (n.length === 0) return false;
  return candidates.some((c) => {
    const t = normalizeQuestion(c);
    return t.length > 0 && (n === t || n.includes(t) || t.includes(n));
  });
}

function cryptoRandomUUID(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback: RFC4122 v4 with Math.random, used only when the runtime lacks
  // crypto.randomUUID (older test environments).
  const rnd = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
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
