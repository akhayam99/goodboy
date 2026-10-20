// @vitest-environment happy-dom

const { holder } = vi.hoisted((): { holder: { backend: ChatBackend | null } } => ({
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
vi.mock('../../../features/workspace-chat/activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import type { ChatBackend } from '../../../features/workspace-chat/chatBackend';
import type { ChatTurnOutcome } from '../../../features/workspace-chat/runChatTurn';
import { createMemoryChatBackend } from '../../../features/workspace-chat/createMemoryChatBackend';
import { liveTextRegistry } from '../../../features/chat/reveal/liveTextRegistry';
import { revealPacer } from '../../../features/chat/reveal/revealPacer';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const HARBORLINE = aWorkspace({ name: 'Harborline' });
const PAYMENTS = aProject({
  workspaceId: HARBORLINE.id,
  name: 'payments-api',
  rootPath: '/Users/mara/code/harborline/payments-api',
});
const LONG_TEXT = 'The 502 comes from notify-relay and ledger-core agrees. '.repeat(20);

let useAppStore: StoryStore;
let outcome: ChatTurnOutcome = { status: 'done' };
let streamedKey: string | null = null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const startChat = async (): Promise<ChatId> => {
  useAppStore.setState({ projects: [PAYMENTS], workspaces: [HARBORLINE] });
  const slice = useAppStore.getState();
  await slice.loadChats({ workspaceId: HARBORLINE.id });
  return slice.createChat({
    workspaceId: HARBORLINE.id,
    provider: 'anthropic',
    model: 'sonnet-5',
  });
};

beforeEach(async () => {
  await resetStoryStore();
  liveTextRegistry.clear();
  revealPacer.reset();
  outcome = { status: 'done' };
  streamedKey = null;
  holder.backend = createMemoryChatBackend({
    respond: async (params) => {
      params.onText('The 502 comes from notify-relay. ');
      const [reply] = (useAppStore.getState().chatMessages[params.request.chatId] ?? []).slice(-1);
      streamedKey = reply === undefined ? null : `${reply.id}:reply`;
      if (streamedKey !== null) {
        revealPacer.track({ key: streamedKey, text: LONG_TEXT, isComplete: false, startCut: 0 });
      }
      return outcome;
    },
  });
});

afterEach(() => {
  revealPacer.reset();
});

describe('chat reply live mark', () => {
  it('marks the reply live while text streams in', async () => {
    const chatId = await startChat();

    await useAppStore.getState().sendChatMessage({ chatId, content: 'why 502?' });

    const reply = (useAppStore.getState().chatMessages[chatId] ?? []).at(-1);
    expect(reply?.role).toBe('assistant');
    expect(liveTextRegistry.isLive({ runId: reply?.id ?? '' })).toBe(true);
  });

  it('keeps pacing the reveal when the reply finishes normally', async () => {
    const chatId = await startChat();

    await useAppStore.getState().sendChatMessage({ chatId, content: 'why 502?' });

    expect(streamedKey).not.toBeNull();
    expect(revealPacer.snapshotOf({ key: streamedKey ?? '' })?.isRevealing).toBe(true);
  });

  it('shows the whole text at once when the reply fails', async () => {
    outcome = { status: 'failed', error: 'connection reset by peer' };
    const chatId = await startChat();

    await useAppStore.getState().sendChatMessage({ chatId, content: 'why 502?' });

    const snapshot = revealPacer.snapshotOf({ key: streamedKey ?? '' });
    expect(snapshot?.isRevealing).toBe(false);
    expect(snapshot?.cut).toBe(LONG_TEXT.length);
  });
});
