import type { SessionId } from '@goodboy/types';
import type { Database } from '@goodboy/db';
import { ContextEngine } from './engine';
import { mergeIntoSlot, removeFromSlot } from './extractors';

export const removeQuestionsFromSlot = async (
  db: Database,
  sessionId: SessionId,
  texts: ReadonlyArray<string>,
): Promise<boolean> => {
  if (texts.length === 0) {
    return false;
  }
  const engine = new ContextEngine({ db });
  const slots = await engine.load(sessionId);
  const existing = slots.find((s) => s.key === 'open_questions')?.value ?? '';
  if (existing.length === 0) {
    return false;
  }
  const next = removeFromSlot(existing, texts);
  if (next === existing) {
    return false;
  }
  await engine.upsert(sessionId, 'open_questions', next);
  return true;
};

type RemoveSessionQuestionsParams = {
  readonly db: Database;
  readonly questions: ReadonlyArray<{ readonly sessionId: SessionId; readonly text: string }>;
};

export const removeSessionQuestionsFromSlots = async ({
  db,
  questions,
}: RemoveSessionQuestionsParams): Promise<ReadonlyArray<SessionId>> => {
  const textsBySession = new Map<SessionId, Array<string>>();
  for (const { sessionId, text } of questions) {
    textsBySession.set(sessionId, [...(textsBySession.get(sessionId) ?? []), text]);
  }
  const changed: Array<SessionId> = [];
  for (const [sessionId, texts] of textsBySession) {
    if (await removeQuestionsFromSlot(db, sessionId, texts)) {
      changed.push(sessionId);
    }
  }
  return changed;
};

export const addQuestionsToSlot = async (
  db: Database,
  sessionId: SessionId,
  texts: ReadonlyArray<string>,
): Promise<boolean> => {
  if (texts.length === 0) {
    return false;
  }
  const engine = new ContextEngine({ db });
  const slots = await engine.load(sessionId);
  const existing = slots.find((s) => s.key === 'open_questions')?.value ?? '';
  const next = mergeIntoSlot(existing, texts);
  if (next === existing) {
    return false;
  }
  await engine.upsert(sessionId, 'open_questions', next);
  return true;
};
