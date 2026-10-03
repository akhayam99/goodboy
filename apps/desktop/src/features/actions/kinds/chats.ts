import type { ChatId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { pluralize } from '../../../shared/utils/pluralize';
import type { ChatsActionTarget, ObjectKindDefinition } from '../types';

export type ChatsFacts = {
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly titles: ReadonlyArray<string>;
  readonly onArchive: () => void;
  readonly onDelete: () => Promise<void>;
};

type CountParams = {
  readonly verb: string;
  readonly facts: ChatsFacts;
};

const countLabel = ({ verb, facts }: CountParams): string =>
  `${verb} ${pluralize(facts.chatIds.length, 'chat')}`;

export const CHATS_KIND: ObjectKindDefinition<ChatsActionTarget, ChatsFacts> = {
  noun: 'chats',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'chats.archive',
      label: ({ facts }) => countLabel({ verb: 'Archive', facts }),
      shortLabel: () => 'Archive',
      icon: CONCEPT_ICONS.archive,
      group: 'act',
      isUndoable: true,
      when: () => true,
      run: ({ facts }) => facts.onArchive(),
    },
    {
      id: 'chats.delete',
      label: ({ facts }) => countLabel({ verb: 'Delete', facts }),
      shortLabel: () => 'Delete',
      icon: CONCEPT_ICONS.delete,
      group: 'danger',
      when: () => true,
      confirm: ({ facts }) => ({
        title: `${countLabel({ verb: 'Delete', facts })}?`,
        description:
          'Their messages are removed from this device. Sessions started from them stay.',
        confirmLabel: countLabel({ verb: 'Delete', facts }),
        role: 'danger',
        goes: 'The messages in these chats, from this device.',
        stays: 'Sessions started from them.',
        items: facts.titles,
        altActionId: 'chats.archive',
      }),
      run: async ({ facts }) => {
        await facts.onDelete();
      },
    },
  ],
};
