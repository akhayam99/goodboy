import { archiveChats } from './archiveChats';
import { createChat } from './createChat';
import { loadChatMessages } from './loadChatMessages';
import { loadChats } from './loadChats';
import { pinChat } from './pinChat';
import { renameChat } from './renameChat';
import { restoreChats } from './restoreChats';
import { sendChatMessage } from './sendChatMessage';
import { setChatModel } from './setChatModel';
import { chatsInitialState } from './state';
import { stopChatReply } from './stopChatReply';
import type { ChatsSlice, GetFn, SetFn } from './types';

export { selectChatGroups, type ChatGroups } from './selectChatGroups';
export { isChatIdle } from './isChatIdle';

export const createChatsSlice = (set: SetFn, get: GetFn): ChatsSlice => ({
  ...chatsInitialState,
  loadChats: loadChats(set, get),
  loadChatMessages: loadChatMessages(set, get),
  createChat: createChat(set),
  sendChatMessage: sendChatMessage(set, get),
  stopChatReply: stopChatReply(set, get),
  archiveChats: archiveChats(set),
  restoreChats: restoreChats(set),
  pinChat: pinChat(set),
  renameChat: renameChat(set),
  setChatModel: setChatModel(set),
});
