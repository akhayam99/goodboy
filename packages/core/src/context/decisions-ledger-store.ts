import {
  listContextSlotsForSession,
  listSessionDecisions,
  saveSessionDecisions,
  upsertContextSlot,
  type Database,
} from '@goodboy/db';
import type { ContextSlotAuthor, IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import {
  applyDecisionOps,
  renderDecisionsSlot,
  seedDecisionLedger,
  type DecisionActor,
  type DecisionChange,
  type DecisionOp,
  type DecisionRejection,
} from './decisions-ledger';

type LoadParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly now?: () => IsoDateTime;
  readonly newId?: () => string;
};

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const randomId = (): string => globalThis.crypto.randomUUID();

type SlotParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

const readDecisionsSlot = async ({ db, sessionId }: SlotParams) => {
  const slots = await listContextSlotsForSession(db, sessionId);
  return slots.find((slot) => slot.key === 'decisions') ?? null;
};

type WriteSlotParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly author: ContextSlotAuthor;
};

type WriteSlotResult = {
  readonly previousValue: string;
  readonly value: string;
};

const writeDerivedSlot = async ({
  db,
  sessionId,
  ledger,
  author,
}: WriteSlotParams): Promise<WriteSlotResult> => {
  const existing = await readDecisionsSlot({ db, sessionId });
  const previousValue = existing?.value ?? '';
  const value = renderDecisionsSlot({ ledger });
  if (existing !== null && existing.value === value) {
    return { previousValue, value };
  }
  if (existing === null && value === '') {
    return { previousValue, value };
  }
  await upsertContextSlot(
    db,
    sessionId,
    { key: 'decisions', value, enabled: existing?.enabled ?? true },
    author,
  );
  return { previousValue, value };
};

export const loadDecisionLedger = async ({
  db,
  sessionId,
  now = isoNow,
  newId = randomId,
}: LoadParams): Promise<ReadonlyArray<SessionDecision>> => {
  const stored = await listSessionDecisions({ db, sessionId });
  if (stored.length > 0) {
    return stored;
  }
  const slot = await readDecisionsSlot({ db, sessionId });
  if (slot === null || slot.value.trim() === '') {
    return stored;
  }
  const seeded = seedDecisionLedger({ sessionId, text: slot.value, now: now(), newId });
  if (seeded.length === 0) {
    return stored;
  }
  await saveSessionDecisions({ db, decisions: seeded });
  await writeDerivedSlot({ db, sessionId, ledger: seeded, author: 'summarizer' });
  return seeded;
};

type ApplyParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly ops: ReadonlyArray<DecisionOp>;
  readonly actor: DecisionActor;
  readonly now?: () => IsoDateTime;
  readonly newId?: () => string;
};

export type AppliedDecisionOps = {
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly changes: ReadonlyArray<DecisionChange>;
  readonly rejected: ReadonlyArray<DecisionRejection>;
  readonly previousSlotValue: string;
  readonly slotValue: string;
};

export const applyDecisionOpsToSession = async ({
  db,
  sessionId,
  ops,
  actor,
  now = isoNow,
  newId = randomId,
}: ApplyParams): Promise<AppliedDecisionOps> => {
  const ledger = await loadDecisionLedger({ db, sessionId, now, newId });
  const result = applyDecisionOps({ sessionId, ledger, ops, actor, now: now(), newId });
  await saveSessionDecisions({ db, decisions: result.touched });
  const slot = await writeDerivedSlot({
    db,
    sessionId,
    ledger: result.ledger,
    author: actor.author === 'user' ? 'user' : 'summarizer',
  });
  return {
    ledger: result.ledger,
    changes: result.changes,
    rejected: result.rejected,
    previousSlotValue: slot.previousValue,
    slotValue: slot.value,
  };
};
