import {
  finishChatMessage,
  insertAskThread,
  insertChatMessage,
  listAskThreads,
  listChatMessages,
  setChatModel,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelChatTurn } from '../../workspace-chat/cancelChatTurn';
import type { AskBackend } from './askBackend';
import { runAskTurn } from './runAskTurn';

export const tauriAskBackend: AskBackend = {
  listThreads: ({ sessionId }) => listAskThreads({ db: tauriDatabase, sessionId }),
  listMessages: ({ threadId }) => listChatMessages({ db: tauriDatabase, chatId: threadId }),
  insertThread: ({ thread }) => insertAskThread({ db: tauriDatabase, thread }),
  setThreadModel: ({ threadId, ...params }) =>
    setChatModel({ db: tauriDatabase, chatId: threadId, ...params }),
  insertMessage: ({ message }) => insertChatMessage({ db: tauriDatabase, message }),
  finishMessage: ({ message }) => finishChatMessage({ db: tauriDatabase, message }),
  runTurn: runAskTurn,
  cancelTurn: cancelChatTurn,
};
