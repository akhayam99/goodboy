import {
  deleteChats,
  finishChatMessage,
  insertChat,
  insertChatMessage,
  insertChatSessionLink,
  listChatMessages,
  listChatSessionLinks,
  listChats,
  renameChat,
  setChatModel,
  setChatPinned,
  setChatsArchived,
  settleStreamingChatMessages,
} from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import { dataUrlToBlob, readBlobAsBase64 } from '../attachments/pendingAttachment';
import { cancelChatTurn } from './cancelChatTurn';
import type { ChatBackend } from './chatBackend';
import { runChatTurn } from './runChatTurn';
import { summarizeForWorkViaAux } from './summarizeForWorkViaAux';

export const tauriChatBackend: ChatBackend = {
  listChats: (params) => listChats({ db: tauriDatabase, ...params }),
  listMessages: ({ chatId }) => listChatMessages({ db: tauriDatabase, chatId }),
  insertChat: ({ chat }) => insertChat({ db: tauriDatabase, chat }),
  insertMessage: ({ message }) => insertChatMessage({ db: tauriDatabase, message }),
  finishMessage: ({ message }) => finishChatMessage({ db: tauriDatabase, message }),
  setArchived: (params) => setChatsArchived({ db: tauriDatabase, ...params }),
  deleteChats: async ({ chatIds }) => {
    await deleteChats({ db: tauriDatabase, chatIds });
    await invokeCommand('chat_attachments_remove', { chatIds });
  },
  insertLink: ({ link }) => insertChatSessionLink({ db: tauriDatabase, link }),
  listLinks: (params) => listChatSessionLinks({ db: tauriDatabase, ...params }),
  setPinned: (params) => setChatPinned({ db: tauriDatabase, ...params }),
  rename: (params) => renameChat({ db: tauriDatabase, ...params }),
  setModel: (params) => setChatModel({ db: tauriDatabase, ...params }),
  settleStreaming: ({ now }) => settleStreamingChatMessages({ db: tauriDatabase, now }),
  writeImage: async ({ chatId, attachmentId, fileName, blob }) =>
    invokeCommand<number>('chat_attachment_write', {
      chatId,
      attachmentId,
      fileName,
      dataBase64: await readBlobAsBase64(blob),
    }),
  readImage: async ({ chatId, attachmentId }) => {
    const dataUrl = await invokeCommand<string>('chat_attachment_read', { chatId, attachmentId });
    const mimeType = dataUrl.slice(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
    return dataUrlToBlob({ dataUrl, mimeType });
  },
  runTurn: runChatTurn,
  cancelTurn: cancelChatTurn,
  summarizeForWork: summarizeForWorkViaAux,
};
