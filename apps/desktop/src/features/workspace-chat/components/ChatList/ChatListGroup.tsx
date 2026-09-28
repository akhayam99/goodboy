import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { ChatId } from '@goodboy/types';
import { ChatListRow } from './ChatListRow';

export type ChatListGroupRow = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly snippet: string;
  readonly time: string;
  readonly isIdle: boolean;
  readonly isPinned: boolean;
};

type GroupAction = {
  readonly label: string;
  readonly onClick: () => void;
};

type Props = {
  readonly title: string;
  readonly rows: ReadonlyArray<ChatListGroupRow>;
  readonly selectedId: ChatId | null;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onPin: (params: { readonly chatId: ChatId; readonly isPinned: boolean }) => void;
  readonly onArchive: (chatId: ChatId) => void;
  readonly action?: GroupAction | null;
  readonly footer?: ReactNode;
};

export const ChatListGroup = ({
  title,
  rows,
  selectedId,
  onSelect,
  onPin,
  onArchive,
  action = null,
  footer = null,
}: Props) => {
  if (rows.length === 0 && footer === null) {
    return null;
  }
  return (
    <section aria-label={title} className="flex flex-col gap-0.5">
      <div className="flex h-7 items-end justify-between px-2 pb-1">
        <Eyebrow label={title} muted />
        {action === null ? null : (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-sm px-1 text-secondary text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {action.label}
          </button>
        )}
      </div>
      {rows.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5">
          {rows.map((row) => (
            <ChatListRow
              key={row.chatId}
              chatId={row.chatId}
              title={row.title}
              snippet={row.snippet}
              time={row.time}
              isIdle={row.isIdle}
              isPinned={row.isPinned}
              isSelected={row.chatId === selectedId}
              onSelect={onSelect}
              onPin={onPin}
              onArchive={onArchive}
            />
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
};
