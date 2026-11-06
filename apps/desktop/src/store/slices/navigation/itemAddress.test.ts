// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenQuestionId, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { closeCurrentLevel } from '../../../app/hooks/useAppShortcuts/closeCurrentLevel';
import { openReviewComment } from '../../../features/resolve/openReviewComment';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { captureLocation } from './captureLocation';
import { parentPlace } from './parentPlace';
import { branchPlace, questionPlace, sessionPlace } from './place';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const WS = 'ws-harborline' as WorkspaceId;
const SESSION = 'session-ledger-core' as SessionId;
const THREAD = 'thread-retry-queue';
const QUESTION = 'question-queue' as OpenQuestionId;

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: SESSION,
    sessions: [aSession({ id: SESSION })],
    setCurrentSession: async () => undefined,
    selectAgent: async () => undefined,
  });
  store.getState().navigate({ to: branchPlace({ sessionId: SESSION, tab: 'comments' }) });
});

const state = () => store.getState();

const threadInAddress = (): string | null => {
  const { place } = captureLocation({ state: state() });
  if (place.at !== 'session' || place.view.target?.kind !== 'branch') {
    return null;
  }
  return place.view.target.threadId;
};

const openThread = (): void => {
  openReviewComment({ navigate: state().navigate, sessionId: SESSION, threadId: THREAD });
};

describe('an open thread is held once, by the address', () => {
  it('names the thread in the address while its panel is open', () => {
    openThread();

    expect(state().drawer).toMatchObject({ kind: 'conversation' });
    expect(threadInAddress()).toBe(THREAD);
  });

  it('clears the address when Esc or the X closes the panel', () => {
    openThread();

    state().closeDrawer();

    expect(state().drawer).toBeNull();
    expect(threadInAddress()).toBeNull();
  });

  it('clears the address on the close key, ⌘W', () => {
    openThread();

    closeCurrentLevel({});

    expect(state().drawer).toBeNull();
    expect(threadInAddress()).toBeNull();
  });

  it('clears the address when a tool is pressed over the thread', () => {
    openThread();

    state().openDrawer({ kind: 'explore', sessionId: SESSION, payload: null });

    expect(state().drawer).toMatchObject({ kind: 'explore' });
    expect(threadInAddress()).toBeNull();
  });

  it('keeps the thread out of the depth: up from an open thread leaves the Branch page', () => {
    openThread();
    const live = captureLocation({ state: state() });

    expect(parentPlace({ state: state(), place: live.place })).toEqual(
      sessionPlace({ sessionId: SESSION }),
    );
  });
});

describe('the close key and a question', () => {
  it('goes back to where the question was opened from', () => {
    state().navigate({ to: sessionPlace({ sessionId: SESSION }) });
    state().navigate({ to: questionPlace({ sessionId: SESSION, questionId: QUESTION }) });
    expect(state().drawer).toMatchObject({ kind: 'question' });

    closeCurrentLevel({});

    expect(state().drawer).toBeNull();
    expect(state().activeLens[SESSION] ?? null).toBeNull();
  });
});
