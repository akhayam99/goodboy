// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestionId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ATTENTION_HANDLED_EVENT } from './attentionHandledEvent';
import { landAttentionTarget } from './landAttentionTarget';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-retries' });
const TARGET = {
  workspaceId: HARBORLINE,
  sessionId: SESSION,
  reason: 'open-question',
  agentId: null,
} as const;

let useAppStore: StoryStore;
const handled = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  handled.mockClear();
  globalThis.addEventListener(ATTENTION_HANDLED_EVENT, handled);
  useAppStore.setState({
    currentWorkspaceId: HARBORLINE,
    sessions: [aSession({ id: SESSION, workspaceId: HARBORLINE })],
  });
});

afterEach(() => {
  globalThis.removeEventListener(ATTENTION_HANDLED_EVENT, handled);
});

describe('landAttentionTarget', () => {
  it('lands on the open question while the question still waits', async () => {
    useAppStore.setState({
      sessionOpenQuestions: {
        [SESSION]: [
          {
            id: brandId<OpenQuestionId>({ value: 'question-backoff' }),
            sessionId: SESSION,
            text: 'Should the retries back off?',
            suggestedAnswers: [],
            isBlocking: false,
            userAnswer: null,
            status: 'open',
            createdAt: brandId<IsoDateTime>({ value: '2026-11-05T09:00:00.000Z' }),
          },
        ],
      },
    });

    expect(await landAttentionTarget({ target: TARGET })).toBe('landed');
    expect(handled).not.toHaveBeenCalled();
  });

  it('says Already handled and opens the session once the question was answered', async () => {
    useAppStore.setState({ sessionOpenQuestions: { [SESSION]: [] } });

    expect(await landAttentionTarget({ target: TARGET })).toBe('handled');
    expect(handled).toHaveBeenCalledOnce();
    expect(useAppStore.getState().currentSessionId).toBe(SESSION);
  });
});
