import { describe, expect, it, vi } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { RENAME_REQUEST_EVENT } from '../renameRequest';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { CHAT_KIND, chatObjectKey, type ChatFacts } from './chat';

const CHAT_ID = 'chat-consent' as ChatId;

const factsOf = (overrides: Partial<ChatFacts> = {}): ChatFacts => ({
  chatId: CHAT_ID,
  title: 'Where is the consent step defined?',
  isPinned: false,
  isUnread: false,
  onToggleUnread: vi.fn(),
  onTogglePin: vi.fn(),
  onArchive: vi.fn(),
  onDelete: vi.fn(async () => undefined),
  ...overrides,
});

const idsOf = (facts: ChatFacts): ReadonlyArray<string> =>
  resolveActions({ definitions: CHAT_KIND.actions, facts }).map((action) => action.id);

const env = { anchorKey: 'chat-row:chat-consent' } as unknown as ActionEnv;

const runOf = ({ id, facts }: { readonly id: string; readonly facts: ChatFacts }) =>
  CHAT_KIND.actions.find((action) => action.id === id)?.run({ facts, env, choice: null });

describe('chat actions', () => {
  it('offers rename, unread, pin, archive and delete on a plain chat', () => {
    expect(idsOf(factsOf())).toEqual([
      'chat.rename',
      'chat.markUnread',
      'chat.pin',
      'chat.archive',
      'chat.delete',
    ]);
  });

  it('flips unread and pinned labels with the chat state', () => {
    expect(idsOf(factsOf({ isUnread: true, isPinned: true }))).toEqual([
      'chat.rename',
      'chat.markRead',
      'chat.unpin',
      'chat.archive',
      'chat.delete',
    ]);
  });

  it('confirms a delete in danger and offers Archive instead', () => {
    const facts = factsOf();
    const remove = resolveActions({ definitions: CHAT_KIND.actions, facts }).find(
      (action) => action.id === 'chat.delete',
    );

    expect(remove?.group).toBe('danger');
    expect(remove?.confirm).toMatchObject({
      title: 'Delete chat?',
      confirmLabel: 'Delete',
      role: 'danger',
      altActionId: 'chat.archive',
    });
  });

  it('runs the row callbacks', async () => {
    const facts = factsOf();

    await runOf({ id: 'chat.markUnread', facts });
    await runOf({ id: 'chat.pin', facts });
    await runOf({ id: 'chat.archive', facts });
    await runOf({ id: 'chat.delete', facts });

    expect(facts.onToggleUnread).toHaveBeenCalledTimes(1);
    expect(facts.onTogglePin).toHaveBeenCalledTimes(1);
    expect(facts.onArchive).toHaveBeenCalledTimes(1);
    expect(facts.onDelete).toHaveBeenCalledTimes(1);
  });

  it('asks the row to rename through the rename request', async () => {
    const seen = vi.fn();
    window.addEventListener(RENAME_REQUEST_EVENT, seen);

    await runOf({ id: 'chat.rename', facts: factsOf() });
    window.removeEventListener(RENAME_REQUEST_EVENT, seen);

    const event = seen.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({
      objectKey: chatObjectKey({ chatId: CHAT_ID }),
      anchorKey: 'chat-row:chat-consent',
    });
  });
});
