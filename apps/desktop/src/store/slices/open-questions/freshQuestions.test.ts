// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
} from '@goodboy/types';

const {
  announceDataChanged,
  listOpenQuestionsForSession,
  markOpenQuestionAnswered,
  markOpenQuestionDismissed,
  removeQuestionsFromSlot,
  restoreOpenQuestion,
  addQuestionsToSlot,
} = vi.hoisted(() => ({
  announceDataChanged: vi.fn(async (_params: unknown) => undefined),
  listOpenQuestionsForSession: vi.fn(),
  markOpenQuestionAnswered: vi.fn(async (_db: unknown, _id: string, _answer: string) => undefined),
  markOpenQuestionDismissed: vi.fn(async (_db: unknown, _id: string) => undefined),
  removeQuestionsFromSlot: vi.fn(async (..._args: ReadonlyArray<unknown>) => false),
  restoreOpenQuestion: vi.fn(async () => undefined),
  addQuestionsToSlot: vi.fn(async () => false),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    listOpenQuestionsForSession,
    markOpenQuestionAnswered,
    markOpenQuestionDismissed,
    restoreOpenQuestion,
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/core/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core/context')>()),
  addQuestionsToSlot,
  removeQuestionsFromSlot,
}));
vi.mock('../../../shared/lib/dataChanged', () => ({
  announceDataChanged,
  listenDataChanged: vi.fn(async () => () => undefined),
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { dismissOpenQuestion } from './dismissOpenQuestion';
import { persistOpenQuestionAnswers } from './persistOpenQuestionAnswers';
import { restoreDismissedOpenQuestion } from './restoreDismissedOpenQuestion';

const sessionId = brandId<SessionId>({ value: 'sess-fresh-1' });

const questionOf = (id: string): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId,
  text: `Question ${id}`,
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: brandId<IsoDateTime>({ value: '2026-07-30T10:00:00.000Z' }),
});

const announced = (): ReadonlyArray<unknown> =>
  announceDataChanged.mock.calls.map((call) => Reflect.get(Object(call[0]), 'change'));

const OPEN_QUESTION_CHANGE = { kind: 'open-question', sessionId };

const deferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<Value>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
});

const idsOf = (): ReadonlyArray<string> =>
  (useAppStore.getState().sessionOpenQuestions[sessionId] ?? []).map((question) => question.id);

const stubReloads = () => {
  const loadSessionOpenQuestions = vi.fn(async () => undefined);
  const loadSessionAnsweredQuestions = vi.fn(async () => undefined);
  useAppStore.setState({
    loadSessionOpenQuestions,
    loadSessionAnsweredQuestions,
    maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
  });
  return { loadSessionOpenQuestions, loadSessionAnsweredQuestions };
};

describe('loadSessionOpenQuestions, two loads that overlap', () => {
  it('keeps the newer answer when the older request settles last', async () => {
    const older = deferred<ReadonlyArray<OpenQuestion>>();
    const newer = deferred<ReadonlyArray<OpenQuestion>>();
    listOpenQuestionsForSession.mockReturnValueOnce(older.promise);
    listOpenQuestionsForSession.mockReturnValueOnce(newer.promise);
    const load = useAppStore.getState().loadSessionOpenQuestions;

    const first = load(sessionId);
    const second = load(sessionId);
    newer.resolve([questionOf('new')]);
    await second;
    older.resolve([questionOf('old')]);
    await first;

    expect(idsOf()).toEqual(['new']);
  });

  it('drops the failure of an older request that a newer one replaced', async () => {
    const older = deferred<ReadonlyArray<OpenQuestion>>();
    listOpenQuestionsForSession.mockReturnValueOnce(older.promise);
    listOpenQuestionsForSession.mockResolvedValueOnce([questionOf('new')]);
    const load = useAppStore.getState().loadSessionOpenQuestions;

    const first = load(sessionId);
    await load(sessionId);
    older.reject(new Error('database is locked'));
    await first;

    expect(useAppStore.getState().sessionQuestionsLoadError[sessionId]).toBeUndefined();
    expect(idsOf()).toEqual(['new']);
  });

  it('records a failure of the latest request and keeps the list it had', async () => {
    listOpenQuestionsForSession.mockRejectedValueOnce(new Error('database is locked'));

    await useAppStore.getState().loadSessionOpenQuestions(sessionId);

    expect(useAppStore.getState().sessionQuestionsLoadError[sessionId]).toContain(
      'database is locked',
    );
    expect(idsOf()).toEqual([]);
  });
});

describe('answering questions', () => {
  const pairOf = (id: string) => ({
    id: brandId<OpenQuestionId>({ value: id }),
    text: `Question ${id}`,
    answer: 'Yes',
  });

  it('announces after the write, then reads the list again (state changed since)', async () => {
    const reloads = stubReloads();
    markOpenQuestionAnswered.mockImplementationOnce(async () => {
      expect(announced()).toEqual([]);
    });

    await persistOpenQuestionAnswers({
      get: useAppStore.getState,
      sessionId,
      pairs: [pairOf('a')],
    });

    expect(announced()).toEqual([OPEN_QUESTION_CHANGE]);
    expect(reloads.loadSessionOpenQuestions).toHaveBeenCalledWith(sessionId);
    expect(reloads.loadSessionAnsweredQuestions).toHaveBeenCalledWith(sessionId);
  });

  it('announces nothing and reads nothing when the write fails (outcome uncertain)', async () => {
    const reloads = stubReloads();
    useAppStore.setState({ sessionOpenQuestions: { [sessionId]: [questionOf('a')] } });
    markOpenQuestionAnswered.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      persistOpenQuestionAnswers({ get: useAppStore.getState, sessionId, pairs: [pairOf('a')] }),
    ).rejects.toThrow('database is locked');

    expect(announced()).toEqual([]);
    expect(reloads.loadSessionOpenQuestions).not.toHaveBeenCalled();
    expect(idsOf()).toEqual(['a']);
  });

  it('shows and announces the answers that were saved when one of two fails (part succeeded)', async () => {
    const reloads = stubReloads();
    markOpenQuestionAnswered.mockResolvedValueOnce(undefined);
    markOpenQuestionAnswered.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      persistOpenQuestionAnswers({
        get: useAppStore.getState,
        sessionId,
        pairs: [pairOf('a'), pairOf('b')],
      }),
    ).rejects.toThrow('database is locked');

    expect(announced()).toEqual([OPEN_QUESTION_CHANGE]);
    expect(removeQuestionsFromSlot).toHaveBeenCalledWith(expect.anything(), sessionId, [
      'Question a',
    ]);
    expect(reloads.loadSessionOpenQuestions).toHaveBeenCalledWith(sessionId);
  });
});

describe('dismissing and restoring a question', () => {
  const dismiss = (question: OpenQuestion) =>
    dismissOpenQuestion(useAppStore.setState, useAppStore.getState)(sessionId, question);

  beforeEach(() => {
    stubReloads();
    useAppStore.setState({
      loadSessionDismissedQuestions: vi.fn(async () => undefined),
      recordSessionEvent: vi.fn(async () => undefined),
      loadSessionSlots: vi.fn(async () => undefined),
    });
  });

  it('keeps a question that arrived while the write ran (state changed since)', async () => {
    useAppStore.setState({ sessionOpenQuestions: { [sessionId]: [questionOf('a')] } });
    markOpenQuestionDismissed.mockImplementationOnce(async () => {
      useAppStore.setState({
        sessionOpenQuestions: { [sessionId]: [questionOf('a'), questionOf('c')] },
      });
    });

    await dismiss(questionOf('a'));

    expect(idsOf()).toEqual(['c']);
    expect(announced()).toEqual([OPEN_QUESTION_CHANGE]);
  });

  it('keeps the question and announces nothing when the write fails (outcome uncertain)', async () => {
    useAppStore.setState({ sessionOpenQuestions: { [sessionId]: [questionOf('a')] } });
    markOpenQuestionDismissed.mockRejectedValueOnce(new Error('database is locked'));

    await expect(dismiss(questionOf('a'))).rejects.toThrow('database is locked');

    expect(idsOf()).toEqual(['a']);
    expect(announced()).toEqual([]);
  });

  it('keeps the dismissal shown and announced when the slot update fails (part succeeded)', async () => {
    useAppStore.setState({ sessionOpenQuestions: { [sessionId]: [questionOf('a')] } });
    removeQuestionsFromSlot.mockRejectedValueOnce(new Error('slot is busy'));

    await expect(dismiss(questionOf('a'))).rejects.toThrow('slot is busy');

    expect(idsOf()).toEqual([]);
    expect(announced()).toEqual([OPEN_QUESTION_CHANGE]);
  });

  it('announces a restored question after the write, and nothing when the write fails', async () => {
    const restore = (question: OpenQuestion) =>
      restoreDismissedOpenQuestion(useAppStore.setState, useAppStore.getState)(sessionId, question);

    await restore(questionOf('a'));
    expect(announced()).toEqual([OPEN_QUESTION_CHANGE]);

    announceDataChanged.mockClear();
    restoreOpenQuestion.mockRejectedValueOnce(new Error('database is locked'));
    await expect(restore(questionOf('b'))).rejects.toThrow('database is locked');
    expect(announced()).toEqual([]);
  });
});
