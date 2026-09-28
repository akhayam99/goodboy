import {
  finishChatMessage,
  insertChat,
  insertChatMessage,
  listChatMessages,
  listChats,
  renameChat,
  setChatModel,
  setChatPinned,
  setChatsArchived,
  settleStreamingChatMessages,
} from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import { cancelChatTurn } from './cancelChatTurn';
import type { ChatBackend } from './chatBackend';
import { runChatTurn } from './runChatTurn';

export const tauriChatBackend: ChatBackend = {
  listChats: (params) => listChats({ db: tauriDatabase, ...params }),
  listMessages: ({ chatId }) => listChatMessages({ db: tauriDatabase, chatId }),
  insertChat: ({ chat }) => insertChat({ db: tauriDatabase, chat }),
  insertMessage: ({ message }) => insertChatMessage({ db: tauriDatabase, message }),
  finishMessage: ({ message }) => finishChatMessage({ db: tauriDatabase, message }),
  setArchived: (params) => setChatsArchived({ db: tauriDatabase, ...params }),
  setPinned: (params) => setChatPinned({ db: tauriDatabase, ...params }),
  rename: (params) => renameChat({ db: tauriDatabase, ...params }),
  setModel: (params) => setChatModel({ db: tauriDatabase, ...params }),
  settleStreaming: ({ now }) => settleStreamingChatMessages({ db: tauriDatabase, now }),
  runTurn: runChatTurn,
  cancelTurn: cancelChatTurn,
};
