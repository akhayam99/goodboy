// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type OpenQuestionId } from '@goodboy/types';

const QUESTION = brandId<OpenQuestionId>({ value: 'question-ledger-1' });
const OTHER = brandId<OpenQuestionId>({ value: 'question-payments-2' });

const freshStore = async () => {
  vi.resetModules();
  return (await import('./useOpenQuestions')).useOpenQuestions;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('a question draft', () => {
  it('comes back after a reload', async () => {
    const before = await freshStore();
    before.getState().setCustomAnswer(QUESTION, 'Alias the export in ledger-core');

    const after = await freshStore();

    expect(after.getState().drafts[QUESTION]?.customAnswer).toBe('Alias the export in ledger-core');
  });

  it('is gone after the answer was sent', async () => {
    const before = await freshStore();
    before.getState().setCustomAnswer(QUESTION, 'Alias the export in ledger-core');
    before.getState().flashAnswered([QUESTION]);

    const after = await freshStore();

    expect(after.getState().drafts[QUESTION]).toBeUndefined();
  });

  it('is gone after the question was dismissed, even when another draft changes later', async () => {
    const before = await freshStore();
    const { storedQuestionDrafts } = await import('./storedQuestionDrafts');
    before.getState().setCustomAnswer(QUESTION, 'Alias the export in ledger-core');

    storedQuestionDrafts.forget({ questionIds: [QUESTION] });
    before.getState().setCustomAnswer(OTHER, 'Keep the payments-api route');
    const after = await freshStore();

    expect(after.getState().drafts[QUESTION]).toBeUndefined();
    expect(after.getState().drafts[OTHER]?.customAnswer).toBe('Keep the payments-api route');
  });

  it('drops a stored draft it cannot read instead of failing', async () => {
    localStorage.setItem('goodboy:question-draft:v1:all', '{"question-ledger-1":{"kind":1}}');

    const after = await freshStore();

    expect(after.getState().drafts).toEqual({});
  });
});
