// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { askDraftKeyOf } from './askDraftKeyOf';
import { askInitialState } from './state';

const SESSION = 'session-ledger' as SessionId;
const OTHER = 'session-notify' as SessionId;
const THREAD = 'thread-retry' as ChatId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ ...askInitialState });
});

describe('the Ask draft', () => {
  it('keys a thread by its id and a thread not created yet by its session', () => {
    expect(askDraftKeyOf({ sessionId: SESSION, threadId: THREAD })).toBe(THREAD);
    expect(askDraftKeyOf({ sessionId: SESSION, threadId: null })).toBe(`${SESSION}:new`);
  });

  it('keeps what was typed per thread and per session', () => {
    const { setAskDraft } = useAppStore.getState();

    setAskDraft({ sessionId: SESSION, threadId: null, text: 'why is the build red' });
    setAskDraft({ sessionId: SESSION, threadId: THREAD, text: 'and the retries?' });
    setAskDraft({ sessionId: OTHER, threadId: null, text: 'unrelated' });

    expect(useAppStore.getState().askDrafts).toEqual({
      [`${SESSION}:new`]: 'why is the build red',
      [THREAD]: 'and the retries?',
      [`${OTHER}:new`]: 'unrelated',
    });
  });

  it('survives closing and reopening the Ask drawer', () => {
    useAppStore.getState().openAsk({ sessionId: SESSION });
    useAppStore
      .getState()
      .setAskDraft({ sessionId: SESSION, threadId: null, text: 'half a thought' });

    useAppStore.getState().closeDrawer();
    useAppStore.getState().openAsk({ sessionId: SESSION });

    expect(useAppStore.getState().drawer).toEqual(
      expect.objectContaining({ kind: 'ask', sessionId: SESSION }),
    );
    expect(useAppStore.getState().askDrafts[`${SESSION}:new`]).toBe('half a thought');
  });

  it('forgets a draft once it is cleared, and only that one', () => {
    const { setAskDraft, clearAskDraft } = useAppStore.getState();
    setAskDraft({ sessionId: SESSION, threadId: null, text: 'one' });
    setAskDraft({ sessionId: SESSION, threadId: THREAD, text: 'two' });

    clearAskDraft({ sessionId: SESSION, threadId: null });

    expect(useAppStore.getState().askDrafts).toEqual({ [THREAD]: 'two' });
  });

  it('treats an emptied field as no draft', () => {
    const { setAskDraft } = useAppStore.getState();
    setAskDraft({ sessionId: SESSION, threadId: null, text: 'one' });

    setAskDraft({ sessionId: SESSION, threadId: null, text: '' });

    expect(useAppStore.getState().askDrafts).toEqual({});
  });
});
