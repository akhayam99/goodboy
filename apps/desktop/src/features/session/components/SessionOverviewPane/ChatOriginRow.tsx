import { useEffect } from 'react';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useChatOrigins } from '../../../../shared/hooks/useChatOrigins';

type Props = {
  readonly session: Session;
};

const KIND_LABEL = {
  new: 'From chat',
  add: 'Fed by chat',
} as const;

export const ChatOriginRow = ({ session }: Props) => {
  const { id: sessionId, workspaceId } = session;
  const origins = useChatOrigins({ sessionId });
  const openStudio = useAppStore((state) => state.openStudio);
  const isChatsLoaded = useAppStore((state) => state.chatsByWorkspace[workspaceId] !== undefined);
  const isArchivedLoaded = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] !== undefined,
  );
  const hasLinks = useAppStore((state) =>
    Object.values(state.chatLinks).some((links) =>
      links.some((link) => link.sessionId === sessionId),
    ),
  );
  const loadChats = useAppStore((state) => state.loadChats);
  const loadArchivedChats = useAppStore((state) => state.loadArchivedChats);

  useEffect(() => {
    if (!isChatsLoaded) {
      void loadChats({ workspaceId });
    }
  }, [isChatsLoaded, loadChats, workspaceId]);

  useEffect(() => {
    if (hasLinks && !isArchivedLoaded) {
      void loadArchivedChats({ workspaceId });
    }
  }, [hasLinks, isArchivedLoaded, loadArchivedChats, workspaceId]);

  if (origins.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {origins.map((origin) => (
        <button
          key={origin.chatId}
          type="button"
          onClick={() => openStudio({ studio: { kind: 'chat', chatId: origin.chatId } })}
          title={`Open the chat ${origin.title}`}
          className="flex min-w-0 items-center gap-2 self-start rounded-sm text-left text-label text-muted-foreground motion-safe:transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="shrink-0">{`${KIND_LABEL[origin.kind]} ·`}</span>
          <span className="min-w-0 truncate text-foreground">{origin.title}</span>
        </button>
      ))}
    </div>
  );
};
