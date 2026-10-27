import { useState } from 'react';
import { IconButton } from '@goodboy/ui';
import { ChatDeleteConfirm } from '../../../../../../features/workspace-chat/components/ChatList/ChatDeleteConfirm';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';

const CHATS = [
  'Where is the consent step?',
  'Refund idempotency options',
  'Cascadia rollout notes',
];

export const ChatDeleteScene = () => {
  const [titles, setTitles] = useState<ReadonlyArray<string>>(CHATS);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <ul data-slot="chat-list" className="flex flex-col gap-0.5">
        {titles.map((title) => (
          <li
            key={title}
            data-chat-row={title}
            className="flex h-10 min-w-0 items-center gap-2 rounded-md px-2 hover:bg-hover"
          >
            <span className="min-w-0 flex-1 truncate text-meta text-foreground">{title}</span>
            <ChatDeleteConfirm
              title={title}
              canArchive
              onDelete={async () => {
                await Promise.resolve();
                setTitles((current) => current.filter((candidate) => candidate !== title));
              }}
              onArchive={() =>
                setTitles((current) => current.filter((candidate) => candidate !== title))
              }
              trigger={({ isArmed, arm }) => (
                <IconButton
                  icon={CONCEPT_ICONS.delete}
                  label={`Delete ${title}`}
                  tooltip="Delete"
                  variant="ghost"
                  aria-expanded={isArmed}
                  aria-haspopup="dialog"
                  onClick={arm}
                />
              )}
            />
          </li>
        ))}
      </ul>
    </main>
  );
};
