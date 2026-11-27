import { brandId, type ChatId, type WorkspaceId } from '@goodboy/types';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';
import type { AppStore } from '../../../store/store';
import type { SendChatMessageAction } from '../contract/actions';
import { chatSendKeyOf, chatSendVersionOf } from './phoneActionIds';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import type { HandlerResult, StoreHandlerParams } from './handlerTypes';
import { bumpSendSequence } from './sendSequence';

export const CHAT_START_WAIT_MS = 20_000;
export const CHAT_START_POLL_MS = 25;

type StartParams = {
  readonly sending: Promise<boolean>;
  readonly getStore: () => AppStore;
  readonly chatId: ChatId;
};

type FinishParams = {
  readonly isStarted: boolean;
};

const startedOf = ({ sending, getStore, chatId }: StartParams): Promise<boolean> =>
  new Promise((resolve) => {
    let isSettled = false;
    const finish = ({ isStarted }: FinishParams): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      stopPoll();
      clearTimeout(limit);
      resolve(isStarted);
    };
    const stopPoll = startPoll({
      run: () => {
        if (getStore().chatStreams[chatId] !== undefined) {
          finish({ isStarted: true });
        }
      },
      everyMs: CHAT_START_POLL_MS,
      gate: 'always',
      isImmediate: false,
    });
    const limit = setTimeout(() => finish({ isStarted: false }), CHAT_START_WAIT_MS);
    sending.then(
      (isStarted) => finish({ isStarted }),
      (error: unknown) => {
        console.error('[bridge] sendChatMessage failed', error);
        finish({ isStarted: false });
      },
    );
  });

export const sendPhoneChatMessage = async ({
  action,
  getStore,
}: StoreHandlerParams<SendChatMessageAction>): Promise<HandlerResult> => {
  const store = getStore();
  const workspaceId = brandId<WorkspaceId>({ value: action.workspaceId });
  const chatId = brandId<ChatId>({ value: action.chatId });
  const chat = (store.chatsByWorkspace[workspaceId] ?? []).find(
    (candidate) => candidate.id === chatId,
  );
  if (chat === undefined || chat.archivedAt !== null) {
    return refusedResult({ code: 'unknown-target', message: "This chat isn't on your Mac." });
  }
  const current = chatSendVersionOf({ chatId: action.chatId });
  if (current !== action.seenVersion) {
    return refusedResult({
      code: 'version-changed',
      message: 'Another message went to this chat first.',
      changes: [{ label: 'Messages', was: action.seenVersion, now: current }],
    });
  }
  if (store.chatStreams[chatId] !== undefined) {
    return refusedResult({ code: 'busy', message: 'This chat is still answering.' });
  }
  const content = action.text.trim();
  if (content.length === 0) {
    return failedResult({ error: 'The message is empty.' });
  }
  const isStarted = await startedOf({
    sending: store.sendChatMessage({ chatId, content }),
    getStore,
    chatId,
  });
  if (!isStarted) {
    return failedResult({ error: "Couldn't send the message." });
  }
  bumpSendSequence({ agentId: chatSendKeyOf({ chatId: action.chatId }) });
  return doneResult();
};
