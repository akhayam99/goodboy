import { invokeCommand } from '../../shared/lib/invokeCommand';

export const pruneChatImages = async (): Promise<void> => {
  await invokeCommand<number>('chat_attachments_prune', {}).catch(() => undefined);
};
