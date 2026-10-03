import { describe, expect, it, vi } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { chatSelectionTarget } from './chatSelectionTarget';
import type { ObjectTarget } from './types';

const A = 'chat-consent' as ChatId;
const B = 'chat-refund' as ChatId;
const C = 'chat-lunch' as ChatId;

const single: ObjectTarget = {
  kind: 'chat',
  facts: {
    chatId: A,
    title: 'Where is the consent step?',
    isPinned: false,
    isUnread: false,
    onToggleUnread: vi.fn(),
    onTogglePin: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(async () => undefined),
  },
};

const several: ObjectTarget = {
  kind: 'chats',
  facts: {
    chatIds: [A, B],
    titles: ['a', 'b'],
    onArchive: vi.fn(),
    onDelete: vi.fn(async () => undefined),
  },
};

describe('chatSelectionTarget', () => {
  it('acts on every selected chat when the row is one of several', () => {
    const clearSelection = vi.fn();

    expect(
      chatSelectionTarget({ chatId: A, selectedIds: [A, B], clearSelection, single, several }),
    ).toBe(several);
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('acts on the row alone, and drops the selection, when the row is outside it', () => {
    const clearSelection = vi.fn();

    expect(
      chatSelectionTarget({ chatId: C, selectedIds: [A, B], clearSelection, single, several }),
    ).toBe(single);
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it('acts on the row alone when it is the only one selected', () => {
    const clearSelection = vi.fn();

    expect(
      chatSelectionTarget({ chatId: A, selectedIds: [A], clearSelection, single, several }),
    ).toBe(single);
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('acts on the row alone when nothing is selected', () => {
    const clearSelection = vi.fn();

    expect(
      chatSelectionTarget({ chatId: A, selectedIds: [], clearSelection, single, several: null }),
    ).toBe(single);
    expect(clearSelection).not.toHaveBeenCalled();
  });
});
