import type { ChatId, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type RememberParams = {
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId | null;
};

export const rememberLastChat =
  ({ set }: Params) =>
  ({ workspaceId, chatId }: RememberParams): void => {
    set((state) => {
      if (state.lastChatByWorkspace[workspaceId] === chatId) {
        return {};
      }
      return { lastChatByWorkspace: { ...state.lastChatByWorkspace, [workspaceId]: chatId } };
    });
  };
