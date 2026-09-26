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
import { applyDecisionOpsToSession } from './decisions-ledger-store';
import type { DecisionChange } from './decisions-ledger';
import { extractMarkers, mergeIntoSlot, removeFromSlot } from './extractors';
import { extractDecisionOps } from './marker-parsing';
import type { SlotKey } from './slots';

const SLOT_ORDER: ReadonlyArray<SlotKey> = ['files_touched', 'decisions', 'open_questions'];

type AgentContext = {
  readonly agentId: AgentId;
  readonly workflowId?: WorkflowId;
  readonly workflowRunId?: WorkflowRunId;
  readonly stepOrdinal?: number;
  readonly turnOrdinal?: number;
};

export type AutoPopulateInput = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly filesEdited: ReadonlyArray<string>;
  readonly assistantText: string;
  readonly agentContext?: AgentContext;
};

export type AutoPopulateResult = {
  readonly updatedSlots: ReadonlyArray<SlotKey>;
  readonly openQuestionsChanged: boolean;
  readonly decisionChanges: ReadonlyArray<DecisionChange>;
};

export const autoPopulateContext = async (
  input: AutoPopulateInput,
): Promise<AutoPopulateResult> => {
  const engine = new ContextEngine({ db: input.db });
  const slots = await engine.load(input.sessionId);

  const { questions, resolved } = extractMarkers(input.assistantText);
  const decisionOps = extractDecisionOps(input.assistantText);

  const resolvedTexts = await listResolvedQuestionTextsForSession(input.db, input.sessionId);
  const freshQuestions = questions.filter((q) => !matchesAny(q.text, resolvedTexts));

  const updates: Array<{ key: SlotKey; value: string }> = [];

  pushUpdate(updates, slots, 'files_touched', input.filesEdited);

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

  const decisions =
    decisionOps.length === 0
      ? null
      : await applyDecisionOpsToSession({
          db: input.db,
          sessionId: input.sessionId,
          ops: decisionOps,
          actor: {
            author: 'agent',
            agentId: input.agentContext?.agentId ?? null,
            turnOrdinal: input.agentContext?.turnOrdinal ?? null,
          },
        });
  const hasDecisionsSlotChanged =
    decisions !== null && decisions.slotValue !== decisions.previousSlotValue;

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
      recommendedAnswer: q.recommendedAnswer ?? undefined,
      selectMode: q.selectMode ?? undefined,
      isBlocking: q.isBlocking,
      turnOrdinal: input.agentContext?.turnOrdinal,
    });
    if (res.inserted) {
      insertedCount += 1;
    }
  }

  const resolvedCount = await markOpenQuestionsResolvedByText(input.db, input.sessionId, resolved);

  const updatedKeys = new Set<SlotKey>(updates.map((u) => u.key));
  if (hasDecisionsSlotChanged) {
    updatedKeys.add('decisions');
  }

  return {
    updatedSlots: SLOT_ORDER.filter((key) => updatedKeys.has(key)),
    openQuestionsChanged: insertedCount > 0 || resolvedCount > 0,
    decisionChanges: decisions?.changes ?? [],
  };
};

function normalizeQuestion(s: string): string {
  return s
    .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
    .trim()
    .toLowerCase();
}

function matchesAny(text: string, candidates: ReadonlyArray<string>): boolean {
  const n = normalizeQuestion(text);
  if (n.length === 0) {
    return false;
  }
  return candidates.some((c) => {
    const t = normalizeQuestion(c);
    return t.length > 0 && (n === t || n.includes(t) || t.includes(n));
  });
}

function cryptoRandomUUID(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
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
  if (additions.length === 0) {
    return;
  }
  const existing = slots.find((s) => s.key === key)?.value ?? '';
  const merged = mergeIntoSlot(existing, additions);
  if (merged !== existing) {
    updates.push({ key, value: merged });
  }
}
