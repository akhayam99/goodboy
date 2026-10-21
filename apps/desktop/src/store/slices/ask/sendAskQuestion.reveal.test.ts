// @vitest-environment happy-dom

const { holder } = vi.hoisted((): { holder: { backend: AskBackend | null } } => ({
  holder: { backend: null },
}));

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
vi.mock('../../../features/session/ask/activeAskBackend', () => ({
  activeAskBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { AskBackend } from '../../../features/session/ask/askBackend';
import { createMemoryAskBackend } from '../../../features/session/ask/createMemoryAskBackend';
import type { ChatTurnOutcome } from '../../../features/workspace-chat/runChatTurn';
import { liveTextRegistry } from '../../../features/chat/reveal/liveTextRegistry';
import { revealPacer } from '../../../features/chat/reveal/revealPacer';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { askInitialState } from './state';

const SESSION = brandId<SessionId>({ value: 'session-webhooks' });
const LONG_TEXT = 'The retry budget lives in notify-relay and ledger-core agrees. '.repeat(20);

let useAppStore: StoryStore;
let outcome: ChatTurnOutcome = { status: 'done' };
let streamedKey: string | null = null;

const replyOf = () => {
  const state = useAppStore.getState();
  const threadId = state.askThreadId[SESSION] ?? null;
  return threadId === null ? undefined : (state.askMessages[threadId] ?? []).at(-1);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  liveTextRegistry.clear();
  revealPacer.reset();
  outcome = { status: 'done' };
  streamedKey = null;
  holder.backend = createMemoryAskBackend({
    respond: async ({ onText }) => {
      onText('The retry budget lives in notify-relay. ');
      const reply = replyOf();
      streamedKey = reply === undefined ? null : `${reply.id}:answer`;
      if (streamedKey !== null) {
        revealPacer.track({ key: streamedKey, text: LONG_TEXT, isComplete: false, startCut: 0 });
      }
      return outcome;
    },
  });
  useAppStore.setState({
    ...askInitialState,
    sessions: [aSession({ id: SESSION, goal: 'Fix webhook retries' })],
    currentSessionId: SESSION,
  });
});

afterEach(() => {
  revealPacer.reset();
});

const ask = () =>
  useAppStore.getState().sendAskQuestion({
    sessionId: SESSION,
    question: 'Where is the retry budget?',
    rightNow: [],
  });

describe('ask answer live mark', () => {
  it('marks the answer live while text streams in', async () => {
    await ask();

    const reply = replyOf();
    expect(reply?.role).toBe('assistant');
    expect(liveTextRegistry.isLive({ runId: reply?.id ?? '' })).toBe(true);
  });

  it('keeps pacing the reveal when the answer finishes normally', async () => {
    await ask();

    expect(streamedKey).not.toBeNull();
    expect(revealPacer.snapshotOf({ key: streamedKey ?? '' })?.isRevealing).toBe(true);
  });

  it('shows the whole text at once when the answer fails', async () => {
    outcome = { status: 'failed', error: 'connection reset by peer' };

    await ask();

    const snapshot = revealPacer.snapshotOf({ key: streamedKey ?? '' });
    expect(snapshot?.isRevealing).toBe(false);
    expect(snapshot?.cut).toBe(LONG_TEXT.length);
  });
});
