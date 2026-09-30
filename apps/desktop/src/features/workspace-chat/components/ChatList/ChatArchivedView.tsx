import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Button, ScrollFade } from '@goodboy/ui';
import type { ChatId, ChatSummary } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { markdownPreview } from '../../../../shared/utils/markdownPreview';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { ChatArchivedRow } from './ChatArchivedRow';
import { ChatPurgeConfirm } from './ChatPurgeConfirm';

type Props = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly selectedId: ChatId | null;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onBack: () => void;
  readonly onRestore: (chatId: ChatId) => void;
  readonly onDelete: (chatIds: ReadonlyArray<ChatId>) => Promise<void>;
};

const matches = ({ chat, needle }: { readonly chat: ChatSummary; readonly needle: string }) =>
  needle === '' ||
  `${chat.title} ${markdownPreview({ text: chat.preview })}`.toLowerCase().includes(needle);

export const ChatArchivedView = ({
  chats,
  selectedId,
  onSelect,
  onBack,
  onRestore,
  onDelete,
}: Props) => {
  const [query, setQuery] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => chats.filter((chat) => matches({ chat, needle })), [chats, needle]);
  const deleteOne = (chatId: ChatId): Promise<void> => onDelete([chatId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 items-center gap-1.5 rounded-md pl-1.5 pr-2 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ArrowLeft size={ICON_SIZE.control} aria-hidden />
          Chats
        </button>
        <h2 className="text-heading text-foreground">Archived</h2>
      </div>
      <label className="flex h-7 items-center gap-2 rounded-md border border-border-soft px-2 text-faint-foreground focus-within:border-border">
        <Search size={ICON_SIZE.row} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search archived"
          aria-label="Search archived"
          className="min-w-0 flex-1 bg-transparent text-label text-foreground outline-none placeholder:text-faint-foreground"
        />
      </label>
      <ScrollFade className="flex-1">
        <nav aria-label="Archived chats" className="flex flex-col gap-0.5 pb-3 pr-3.5">
          {shown.length === 0 ? (
            <p className="px-2 py-4 text-label text-faint-foreground">
              {chats.length === 0 ? 'No archived chats' : 'No archived chats match'}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {shown.map((chat) => (
                <ChatArchivedRow
                  key={chat.id}
                  chatId={chat.id}
                  title={chat.title}
                  snippet={markdownPreview({ text: chat.preview })}
                  age={`archived ${formatRelativeDuration(chat.archivedAt ?? chat.updatedAt)}`}
                  isSelected={chat.id === selectedId}
                  onSelect={onSelect}
                  onRestore={onRestore}
                  onDelete={deleteOne}
                />
              ))}
            </ul>
          )}
        </nav>
      </ScrollFade>
      {chats.length === 0 ? null : (
        <div className="shrink-0 pb-2">
          {isPurging ? (
            <ChatPurgeConfirm
              count={chats.length}
              onDelete={async () => {
                await onDelete(chats.map((chat) => chat.id));
                setIsPurging(false);
              }}
              onCancel={() => setIsPurging(false)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-danger"
              onClick={() => setIsPurging(true)}
            >
              Delete all archived
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
