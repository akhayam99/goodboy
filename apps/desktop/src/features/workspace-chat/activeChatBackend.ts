import type { ChatBackend } from './chatBackend';
import { tauriChatBackend } from './tauriChatBackend';

type RegisterParams = {
  readonly backend: ChatBackend;
};

export const activeChatBackend: ChatBackend = { ...tauriChatBackend };

export const registerChatBackend = ({ backend }: RegisterParams): void => {
  Object.assign(activeChatBackend, backend);
};
