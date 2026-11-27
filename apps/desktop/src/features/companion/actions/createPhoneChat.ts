import { brandId, type WorkspaceId } from '@goodboy/types';
import { CHAT_PROVIDER_REFUSAL } from '../../workspace-chat/chatProviderRefusal';
import { defaultRoutingOfWorkspace } from '../../workspace-chat/defaultRoutingOfWorkspace';
import type { CreateChatAction } from '../contract/actions';
import { chatCreateKeyOf } from './phoneActionIds';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import type { HandlerResult, StoreHandlerParams } from './handlerTypes';
import { bumpSendSequence } from './sendSequence';

export const createPhoneChat = async ({
  action,
  getStore,
}: StoreHandlerParams<CreateChatAction>): Promise<HandlerResult> => {
  const store = getStore();
  const workspaceId = brandId<WorkspaceId>({ value: action.workspaceId });
  if (!store.workspaces.some((workspace) => workspace.id === workspaceId)) {
    return refusedResult({ code: 'unknown-target', message: "This workspace isn't on your Mac." });
  }
  try {
    const { provider, model, effort } = await defaultRoutingOfWorkspace({
      state: store,
      workspaceId,
    });
    const chatId = await store.createChat({ workspaceId, provider, model });
    if (effort !== null) {
      await getStore().setChatModel({ chatId, provider, model, effort });
    }
    bumpSendSequence({ agentId: chatCreateKeyOf({ workspaceId: action.workspaceId }) });
    return doneResult({ createdChatId: chatId });
  } catch (error) {
    console.error('[bridge] createChat failed', error);
    return failedResult({
      error:
        error instanceof Error && error.message === CHAT_PROVIDER_REFUSAL
          ? CHAT_PROVIDER_REFUSAL
          : "Couldn't start the chat.",
    });
  }
};
