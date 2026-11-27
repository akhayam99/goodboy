import { useAppStore } from '../../../store/store';
import { asString } from '../asString';
import { BridgeSafeError } from '../bridgeSafeError';
import { chatMessagesOf } from './chatMessagesOf';

type Params = {
  readonly data: Record<string, unknown>;
};

export const queryChatMessagesCommand = async ({ data }: Params) => {
  const workspaceId = asString({ value: data.workspaceId });
  const chatId = asString({ value: data.chatId });
  if (workspaceId === undefined || chatId === undefined) {
    throw new BridgeSafeError('queryChatMessages requires workspaceId and chatId');
  }
  const projection = await chatMessagesOf({
    query: {
      workspaceId,
      chatId,
      limit: typeof data.limit === 'number' ? data.limit : 50,
      beforeMessageId: asString({ value: data.beforeMessageId }) ?? null,
    },
    getStore: () => useAppStore.getState(),
  });
  if (projection === null) {
    throw new BridgeSafeError('unknown chat for workspace');
  }
  return projection;
};
