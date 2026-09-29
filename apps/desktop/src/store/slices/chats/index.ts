import { archiveChats } from './archiveChats';
import { archiveIdleChats } from './archiveIdleChats';
import { createChat } from './createChat';
import { loadChatMessages } from './loadChatMessages';
import { loadChats } from './loadChats';
import { markChatRead } from './markChatRead';
import { markChatUnread } from './markChatUnread';
import { pinChat } from './pinChat';
import { renameChat } from './renameChat';
import { restoreChats } from './restoreChats';
import { sendChatMessage } from './sendChatMessage';
import { setChatModel } from './setChatModel';
import { chatsInitialState } from './state';
import { stopChatReply } from './stopChatReply';
import type { ChatsSlice, GetFn, SetFn } from './types';
import { readUnreadChats } from './unreadStorage';

export const createChatsSlice = (set: SetFn, get: GetFn): ChatsSlice => ({
  ...chatsInitialState,
  unreadChatIds: readUnreadChats(),
  loadChats: loadChats(set, get),
  loadChatMessages: loadChatMessages(set, get),
  createChat: createChat(set),
  sendChatMessage: sendChatMessage(set, get),
  stopChatReply: stopChatReply(set, get),
  archiveChats: archiveChats(set),
  archiveIdleChats: archiveIdleChats(get),
  restoreChats: restoreChats(set),
  pinChat: pinChat(set),
  renameChat: renameChat(set),
  setChatModel: setChatModel(set),
  markChatRead: markChatRead(set),
  markChatUnread: markChatUnread(set),
});
