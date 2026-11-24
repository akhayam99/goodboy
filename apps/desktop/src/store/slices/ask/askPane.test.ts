// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

type Gates = {
  beforeThread: (() => Promise<void>) | null;
  listMessages: ((threadId: string) => Promise<void>) | null;
};

const { gates } = vi.hoisted(() => {
  const open: Gates = { beforeThread: null, listMessages: null };
  return { gates: open };
});

vi.mock('../../../features/session/ask/activeAskBackend', async () => {
  const { createMemoryAskBackend } = await import('../../../test/createMemoryAskBackend');
  const backend = createMemoryAskBackend({
    respond: async ({ onText }) => {
      onText('**The Reviewer waits on you.**');
      return { status: 'done' };
    },
  });
  return {
    activeAskBackend: {
      ...backend,
      insertThread: async (params: Parameters<typeof backend.insertThread>[0]) => {
        await gates.beforeThread?.();
        return backend.insertThread(params);
      },
      listMessages: async (params: Parameters<typeof backend.listMessages>[0]) => {
        await gates.listMessages?.(params.threadId);
        return backend.listMessages(params);
      },
    },
  };
});

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AskThread,
  type ChatId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { askInitialState } from './state';
import { selectIsAskOpen } from './selectIsAskOpen';

const SESSION = brandId<SessionId>({ value: 'session-harborline-credit' });
const OTHER = brandId<SessionId>({ value: 'session-northwind-relay' });
const EARLIER = brandId<ChatId>({ value: 'thread-earlier-credit' });
const OLDER = brandId<ChatId>({ value: 'thread-older-relay' });
const AT = brandId<IsoDateTime>({ value: '2026-11-23T09:00:00.000Z' });

type ThreadParams = {
  readonly id: ChatId;
  readonly title: string;
};

const threadOf = ({ id, title }: ThreadParams): AskThread => ({
  id,
  workspaceId: aSession({ id: SESSION }).workspaceId,
  sessionId: SESSION,
  title,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'low',
  lastActivityAt: AT,
  createdAt: AT,
  messageCount: 1,
});

type Deferred = {
  readonly promise: Promise<void>;
  readonly release: () => void;
  readonly fail: (error: Error) => void;
};

const deferred = (): Deferred => {
  let release = (): void => undefined;
  let fail = (_error: Error): void => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  return { promise, release, fail };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  gates.beforeThread = null;
  gates.listMessages = null;
  useAppStore.setState({
    ...askInitialState,
    sessions: [aSession({ id: SESSION }), aSession({ id: OTHER })],
    currentSessionId: SESSION,
    askThreads: {
      [SESSION]: [
        threadOf({ id: EARLIER, title: 'Why did the first credit post twice?' }),
        threadOf({ id: OLDER, title: 'Which agent touched notify-relay?' }),
      ],
    },
  });
});

describe('the Ask pane of a session', () => {
  it('opens and closes for the session it names and leaves another session as it was', () => {
    useAppStore.getState().openAsk({ sessionId: SESSION });

    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: SESSION })).toBe(true);
    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: OTHER })).toBe(false);
    expect(useAppStore.getState().drawer).toBeNull();

    useAppStore.getState().closeAsk({ sessionId: SESSION });

    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: SESSION })).toBe(false);
  });

  it('reads as closed while a studio covers the session', () => {
    useAppStore.getState().openAsk({ sessionId: SESSION });
    useAppStore.getState().openStudio({ studio: { kind: 'notifications' } });

    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: SESSION })).toBe(false);
  });

  it('keeps the thread the user picked when the thread of an older question is saved late', async () => {
    const insert = deferred();
    gates.beforeThread = () => insert.promise;
    const sent = useAppStore
      .getState()
      .sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });

    await useAppStore.getState().showAskThread({ sessionId: SESSION, threadId: EARLIER });
    insert.release();
    await sent;

    const state = useAppStore.getState();
    expect(state.askThreadId[SESSION]).toBe(EARLIER);
    const asked = state.askThreads[SESSION]?.find((thread) => thread.title === 'What needs me?');
    expect(asked).toBeDefined();
    expect(state.askMessages[asked?.id ?? EARLIER]?.at(-1)?.status).toBe('done');
  });

  it('drops a late load of an earlier thread once a newer pick came', async () => {
    const slow = deferred();
    gates.listMessages = (threadId) => (threadId === EARLIER ? slow.promise : Promise.resolve());
    const first = useAppStore.getState().showAskThread({ sessionId: SESSION, threadId: EARLIER });

    await useAppStore.getState().showAskThread({ sessionId: SESSION, threadId: OLDER });
    slow.release();
    await first;

    expect(useAppStore.getState().askThreadId[SESSION]).toBe(OLDER);
  });

  it('drops a late load once New question started a fresh thread', async () => {
    const slow = deferred();
    gates.listMessages = () => slow.promise;
    const pick = useAppStore.getState().showAskThread({ sessionId: SESSION, threadId: EARLIER });

    useAppStore.getState().newAskThread({ sessionId: SESSION });
    slow.release();
    await pick;

    expect(useAppStore.getState().askThreadId[SESSION] ?? null).toBeNull();
  });

  it('keeps the shown thread when an earlier one fails to load, and shows the failure', async () => {
    const broken = deferred();
    gates.listMessages = () => broken.promise;
    const pick = useAppStore.getState().showAskThread({ sessionId: SESSION, threadId: EARLIER });
    broken.fail(new Error('the database is locked'));

    await expect(pick).rejects.toThrow('the database is locked');
    expect(useAppStore.getState().askThreadId[SESSION] ?? null).toBeNull();
  });
});
