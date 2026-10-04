import { memo, useEffect, useRef, useState } from 'react';
import { ArchiveRestore } from 'lucide-react';
import { IconButton, InteractiveRow, cn } from '@goodboy/ui';
import type { ChatId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ChatDeleteConfirm } from './ChatDeleteConfirm';

type Props = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly snippet: string;
  readonly age: string;
  readonly isSelected: boolean;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onRestore: (chatId: ChatId) => void;
  readonly onDelete: (chatId: ChatId) => Promise<void>;
};

const ChatArchivedRowView = ({
  chatId,
  title,
  snippet,
  age,
  isSelected,
  onSelect,
  onRestore,
  onDelete,
}: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isConfirming) {
      confirmRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isConfirming]);

  if (isConfirming) {
    return (
      <li ref={confirmRef} data-chat-row={chatId}>
        <ChatDeleteConfirm
          title={title}
          canArchive={false}
          onDelete={() => onDelete(chatId)}
          onArchive={() => setIsConfirming(false)}
          onCancel={() => setIsConfirming(false)}
        />
      </li>
    );
  }
  return (
    <li data-chat-row={chatId} data-archived="true">
      <InteractiveRow
        label={title}
        isSelected={isSelected}
        onOpen={() => onSelect(chatId)}
        frameClassName="group"
        className="flex min-w-0 flex-col gap-0.5 py-2 pl-4 pr-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-label group-hover:pr-12 group-focus-within:pr-12',
              isSelected ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {title}
          </span>
          <span className="shrink-0 text-meta text-faint-foreground group-hover:invisible group-focus-within:invisible">
            {age}
          </span>
        </span>
        <span className="truncate text-meta text-faint-foreground">{snippet}</span>
        <span className="absolute right-0 top-0 flex items-center opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <IconButton
            icon={ArchiveRestore}
            label={`Restore ${title}`}
            tooltip="Restore"
            variant="ghost"
            iconSize={12}
            onClick={() => onRestore(chatId)}
          />
          <IconButton
            icon={CONCEPT_ICONS.delete}
            label={`Delete ${title}`}
            tooltip="Delete"
            variant="ghost"
            iconSize={12}
            onClick={() => setIsConfirming(true)}
          />
        </span>
      </InteractiveRow>
    </li>
  );
};

export const ChatArchivedRow = memo(ChatArchivedRowView);
