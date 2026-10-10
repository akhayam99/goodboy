import type { ChatId, WorkspaceId } from '@goodboy/types';

export type ChatLastOpenState = {
  readonly lastChatByWorkspace: Readonly<Record<WorkspaceId, ChatId | null>>;
};

export const chatLastOpenInitialState: ChatLastOpenState = {
  lastChatByWorkspace: {},
};
