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
