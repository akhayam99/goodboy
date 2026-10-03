import { describe, expect, it, vi } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { CHATS_KIND, type ChatsFacts } from './chats';

const IDS: ReadonlyArray<ChatId> = [
  'chat-consent' as ChatId,
  'chat-refund' as ChatId,
  'chat-lunch' as ChatId,
];

const factsOf = (count: number, overrides: Partial<ChatsFacts> = {}): ChatsFacts => ({
  chatIds: IDS.slice(0, count),
  titles: ['Where is the consent step?', 'Refund idempotency options', 'Lunch ideas'].slice(
    0,
    count,
  ),
  onArchive: vi.fn(),
  onDelete: vi.fn(async () => undefined),
  ...overrides,
});

const env: ActionEnv = {
  getState: () => {
    throw new Error('chat actions never read the store');
  },
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'button',
  anchorKey: null,
  viewing: null,
};

const resolved = (facts: ChatsFacts) => resolveActions({ definitions: CHATS_KIND.actions, facts });

describe('chats actions', () => {
  it('offers archive and delete, counting the chats in the words', () => {
    expect(
      resolved(factsOf(3)).map((action) => [action.id, action.label, action.shortLabel]),
    ).toEqual([
      ['chats.archive', 'Archive 3 chats', 'Archive'],
      ['chats.delete', 'Delete 3 chats', 'Delete'],
    ]);
    expect(resolved(factsOf(1)).map((action) => action.label)).toEqual([
      'Archive 1 chat',
      'Delete 1 chat',
    ]);
  });

  it('archives without a confirmation and says it can be undone', () => {
    const archive = resolved(factsOf(2)).find((action) => action.id === 'chats.archive');

    expect(archive?.confirm).toBeNull();
    expect(archive?.isUndoable).toBe(true);
  });

  it('confirms a delete once for all of them, in danger, listing the titles and offering Archive instead', () => {
    const confirm = resolved(factsOf(3)).find((action) => action.id === 'chats.delete')?.confirm;

    expect(confirm).toMatchObject({
      title: 'Delete 3 chats?',
      confirmLabel: 'Delete 3 chats',
      role: 'danger',
      altActionId: 'chats.archive',
      stays: 'Sessions started from them.',
      items: ['Where is the consent step?', 'Refund idempotency options', 'Lunch ideas'],
    });
  });

  it('runs one archive and one delete for the whole selection', async () => {
    const facts = factsOf(3);

    await CHATS_KIND.actions
      .find((action) => action.id === 'chats.archive')
      ?.run({ facts, env, choice: null });
    await CHATS_KIND.actions
      .find((action) => action.id === 'chats.delete')
      ?.run({ facts, env, choice: null });

    expect(facts.onArchive).toHaveBeenCalledTimes(1);
    expect(facts.onDelete).toHaveBeenCalledTimes(1);
  });
});
