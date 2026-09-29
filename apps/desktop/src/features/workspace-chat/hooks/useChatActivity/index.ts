import { useAppStore } from '../../../../store';

export type ChatActivity = {
  readonly runningCount: number;
  readonly hasUnread: boolean;
};

export const useChatActivity = (): ChatActivity => {
  const runningCount = useAppStore((state) => Object.keys(state.chatStreams).length);
  const hasUnread = useAppStore((state) => state.unreadChatIds.length > 0);
  return { runningCount, hasUnread };
};
