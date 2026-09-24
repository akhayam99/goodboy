import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenQuestion, SessionId } from '@goodboy/types';

const { listOpenQuestionsForSession } = vi.hoisted(() => ({
  listOpenQuestionsForSession: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({ listOpenQuestionsForSession }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { loadSessionAnsweredQuestions } from './loadSessionAnsweredQuestions';
import { loadSessionOpenQuestions } from './loadSessionOpenQuestions';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const sessionId = 'sess-1' as SessionId;

const makeSet = () => {
  let state = {
    sessionOpenQuestions: {},
    sessionAnsweredQuestions: {},
    sessionQuestionsLoadError: {},
  } as unknown as AppStore;
  const set: SetFn = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
  };
  return { set, read: () => state };
};

beforeEach(() => {
  listOpenQuestionsForSession.mockReset();
});

describe('question loaders', () => {
  it('records the failure instead of rejecting', async () => {
    listOpenQuestionsForSession.mockRejectedValueOnce(new Error('database is locked'));
    const { set, read } = makeSet();

    await expect(loadSessionOpenQuestions(set)(sessionId)).resolves.toBeUndefined();

    expect(read().sessionQuestionsLoadError[sessionId]).toContain('database is locked');
    expect(read().sessionOpenQuestions[sessionId]).toBeUndefined();
  });

  it('clears the recorded failure when a retry loads', async () => {
    const answered: ReadonlyArray<OpenQuestion> = [];
    listOpenQuestionsForSession.mockRejectedValueOnce(new Error('boom'));
    listOpenQuestionsForSession.mockResolvedValueOnce(answered);
    const { set, read } = makeSet();

    await loadSessionAnsweredQuestions(set)(sessionId);
    await loadSessionAnsweredQuestions(set)(sessionId);

    expect(read().sessionQuestionsLoadError[sessionId]).toBeUndefined();
    expect(read().sessionAnsweredQuestions[sessionId]).toBe(answered);
  });
});
