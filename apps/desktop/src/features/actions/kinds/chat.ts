import { Mail, MailOpen, Pencil, Pin, PinOff } from 'lucide-react';
import type { ChatId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { requestRename } from '../renameRequest';
import type { ChatActionTarget, ObjectKindDefinition } from '../types';

export type ChatFacts = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly isPinned: boolean;
  readonly isUnread: boolean;
  readonly onToggleUnread: () => void;
  readonly onTogglePin: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => Promise<void>;
};

type ObjectKeyParams = {
  readonly chatId: ChatId;
};

export const chatObjectKey = ({ chatId }: ObjectKeyParams): string => `chat:${chatId}`;

export const CHAT_KIND: ObjectKindDefinition<ChatActionTarget, ChatFacts> = {
  noun: 'chat',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'chat.rename',
      label: 'Rename',
      icon: Pencil,
      group: 'act',
      when: () => true,
      run: ({ facts, env }) => {
        requestRename({
          objectKey: chatObjectKey({ chatId: facts.chatId }),
          anchorKey: env.anchorKey,
        });
      },
    },
    {
      id: 'chat.markUnread',
      label: 'Mark as unread',
      icon: Mail,
      group: 'act',
      when: ({ facts }) => !facts.isUnread,
      run: ({ facts }) => facts.onToggleUnread(),
    },
    {
      id: 'chat.markRead',
      label: 'Mark as read',
      icon: MailOpen,
      group: 'act',
      when: ({ facts }) => facts.isUnread,
      run: ({ facts }) => facts.onToggleUnread(),
    },
    {
      id: 'chat.pin',
      label: 'Pin',
      icon: Pin,
      group: 'act',
      when: ({ facts }) => !facts.isPinned,
      run: ({ facts }) => facts.onTogglePin(),
    },
    {
      id: 'chat.unpin',
      label: 'Unpin',
      icon: PinOff,
      group: 'act',
      when: ({ facts }) => facts.isPinned,
      run: ({ facts }) => facts.onTogglePin(),
    },
    {
      id: 'chat.archive',
      label: 'Archive',
      icon: CONCEPT_ICONS.archive,
      group: 'act',
      when: () => true,
      run: ({ facts }) => facts.onArchive(),
    },
    {
      id: 'chat.delete',
      label: 'Delete',
      icon: CONCEPT_ICONS.delete,
      group: 'danger',
      when: () => true,
      confirm: () => ({
        title: 'Delete chat?',
        description: 'Its messages are removed from this device. Sessions started from it stay.',
        confirmLabel: 'Delete',
        role: 'danger',
        altActionId: 'chat.archive',
      }),
      run: async ({ facts }) => {
        await facts.onDelete();
      },
    },
  ],
};
