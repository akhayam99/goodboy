import { describe, expect, it, vi } from 'vitest';
import type { ChatId, IsoDateTime, ProviderRunId, WorkspaceId } from '@goodboy/types';
import { selectChatGroups } from '../../store/slices/chats/selectChatGroups';
import { createMemoryChatBackend } from './createMemoryChatBackend';
import { mockChatResponder } from './mockChatResponder';
import { mockChatSeed } from './mockChatSeed';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const NOW = Date.parse('2026-09-28T15:00:00.000Z');

describe('mock chat backend', () => {
  it('seeds a Harborline list that fills every group', async () => {
    const backend = createMemoryChatBackend({
      respond: mockChatResponder,
      seed: ({ workspaceId }) => mockChatSeed({ workspaceId, now: NOW }),
    });

    const chats = await backend.listChats({ workspaceId: WORKSPACE });
    const groups = selectChatGroups({ chats, now: NOW });

    expect(groups.pinned.map((chat) => chat.title)).toEqual(['Release checklist for payments-api']);
    expect(groups.today).toHaveLength(2);
    expect(groups.week).toHaveLength(2);
    expect(groups.idle.map((chat) => chat.title)).toEqual([
      'Lunch ideas near the office',
      'Rename the webhook table?',
      'Flaky test in ledger-core',
    ]);
    expect(chats.every((chat) => chat.preview !== null)).toBe(true);
  });

  it('streams a canned answer for the last question only', async () => {
    vi.useFakeTimers();
    const text: string[] = [];
    const reads: string[] = [];
    const reply = mockChatResponder({
      request: {
        runId: 'run' as ProviderRunId,
        chatId: 'chat' as ChatId,
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        workingDir: '/Users/mara/code/harborline',
        readRoots: [],
        prompt:
          'Earlier in this chat:\nUser: lunch?\n\nNew question:\nWhy does notify-relay retry?',
        systemPrompt: '',
      },
      onText: (delta) => text.push(delta),
      onRead: (path) => reads.push(path),
      isCancelled: () => false,
      now: () => '2026-09-28T15:00:00.000Z' as IsoDateTime,
    });
    await vi.runAllTimersAsync();

    expect(await reply).toEqual({ status: 'done' });
    expect(reads[0]).toBe('notify-relay/src/queue/worker.ts');
    expect(text.join('')).toMatch(/^\*\*Two layers retry the same failure/);
    vi.useRealTimers();
  });
});
