import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button, ICON_SIZE, ScrollFade, tintClasses } from '@goodboy/ui';
import type { ChatId, ChatSummary } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';
import { markdownPreview } from '../../../../shared/utils/markdownPreview';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
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
  const now = useNow(60_000);
  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => chats.filter((chat) => matches({ chat, needle })), [chats, needle]);
  const deleteOne = (chatId: ChatId): Promise<void> => onDelete([chatId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2">
      <StudioTrail
        segments={[
          {
            id: 'chat',
            label: 'Chat',
            icon: CONCEPT_ICONS.chat,
            iconClassName: tintClasses(CONCEPT_TONE.chat).icon,
            onSelect: onBack,
          },
          { id: 'archived', label: 'Archived', icon: CONCEPT_ICONS.chat },
        ]}
      />
      <h2 className="text-heading text-foreground">Archived</h2>
      <label className="flex h-7 items-center gap-2 rounded-md border border-border-soft px-2 text-faint-foreground focus-within:border-border">
        <Search size={ICON_SIZE.row} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search archived"
          aria-label="Search archived"
          className="min-w-0 flex-1 bg-transparent text-meta text-foreground outline-none placeholder:text-faint-foreground"
        />
      </label>
      <ScrollFade className="flex-1">
        <nav aria-label="Archived chats" className="flex flex-col gap-0.5 pb-3 pr-4">
          {shown.length === 0 ? (
            <p className="px-2 py-4 text-meta text-faint-foreground">
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
                  age={`archived ${formatSpan({ from: chat.archivedAt ?? chat.updatedAt, to: now })}`}
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
          <ChatPurgeConfirm
            count={chats.length}
            onDelete={() => onDelete(chats.map((chat) => chat.id))}
            trigger={({ arm }) => (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-danger"
                aria-haspopup="dialog"
                onClick={arm}
              >
                Delete all archived
              </Button>
            )}
          />
        </div>
      )}
    </div>
  );
};
