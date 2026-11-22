// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type AgentId, type OpenQuestion, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { openQuestionFor, sessionOf } from '../../../../workspace/testing/sessionColumn';
import type { QueueMove } from '../../needsYouOf';
import { useQueueSends } from '../useQueueSends';
import { useQueueActions } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const answers = vi.fn(async () => undefined);
const asking = sessionOf({ goal: 'Fix webhook retries' });
const sessionId = brandId<SessionId>({ value: asking.id });
const question: OpenQuestion = {
  ...openQuestionFor({ sessionId }),
  suggestedAnswers: ['Keep five minutes', 'Drop to one minute'],
};
const move: QueueMove = {
  id: `${sessionId}:question:${question.id}`,
  sessionId,
  reason: 'open-question',
  kind: 'answer',
  title: question.text,
  question,
  since: null,
};

type QuestionParams = {
  readonly status: OpenQuestion['status'];
};

const seedQuestion = ({ status }: QuestionParams): void =>
  useAppStore.setState({
    sessionOpenQuestions: { [sessionId]: [{ ...question, status }] },
    answerOpenQuestions: answers,
  });

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

beforeEach(async () => {
  await resetStoryStore();
  answers.mockClear();
  useQueueSends.setState({ pending: {}, notNow: new Set(), drafts: {} });
  seedQuestion({ status: 'open' });
});

afterEach(() => {
  useQueueSends.getState().flushAll();
  cleanup();
});

const undoLast = async (): Promise<boolean> => {
  let isUndone = false;
  await act(async () => {
    isUndone = await useAppStore.getState().undoLastOperation();
  });
  return isUndone;
};

describe('useQueueActions, a gesture the agent has not read yet has Undo', () => {
  it('undo of an answer, as from ⌘Z, stops it before the agent sees it', async () => {
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.answer({ move, text: 'Keep five minutes' }));
    expect(Object.values(useQueueSends.getState().pending)).toEqual([
      expect.objectContaining({ kind: 'answer', moveId: move.id }),
    ]);

    expect(await undoLast()).toBe(true);
    expect(useQueueSends.getState().pending).toEqual({});
    await act(async () => useQueueSends.getState().flushAll());
    expect(answers).not.toHaveBeenCalled();
  });

  it('sends the answer to the question it named once the window closes', async () => {
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.answer({ move, text: 'Keep five minutes' }));
    await act(async () => useQueueSends.getState().flushAll());
    expect(answers).toHaveBeenCalledWith(
      sessionId,
      [{ id: question.id, text: question.text, answer: 'Keep five minutes' }],
      null,
    );
    expect(await undoLast()).toBe(false);
  });

  it('sends nothing when the same Move was answered in another window first', async () => {
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.answer({ move, text: 'Keep five minutes' }));
    seedQuestion({ status: 'answered' });
    await act(async () => useQueueSends.getState().flushAll());
    expect(answers).not.toHaveBeenCalled();
  });

  it('undo of a message to an agent keeps it out of the agent queue', async () => {
    const enqueue = vi.fn(async () => true);
    useAppStore.setState({ enqueueAgentMessage: enqueue });
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() =>
      result.current.message({
        sessionId,
        agentId: brandId<AgentId>({ value: 'implementer-payments-api' }),
        text: 'Use the ledger-core fixture',
      }),
    );
    expect(await undoLast()).toBe(true);
    await act(async () => useQueueSends.getState().flushAll());
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('undo of Not now brings the Move back once', async () => {
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.notNow({ move }));
    expect(useQueueSends.getState().notNow.has(move.id)).toBe(true);
    expect(await undoLast()).toBe(true);
    expect(useQueueSends.getState().notNow.has(move.id)).toBe(false);
  });
});
