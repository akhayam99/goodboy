import type { QueueChatMessageParams, SliceDeps } from './types';

export const submitChatMessage =
  ({ get }: SliceDeps) =>
  async ({ chatId, content, attachments }: QueueChatMessageParams): Promise<boolean> => {
    if (get().chatStreams[chatId] !== undefined) {
      return get().enqueueChatMessage({ chatId, content, attachments });
    }
    return get().sendChatMessage({ chatId, content, attachments });
  };
