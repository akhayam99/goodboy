import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { ProviderRunId } from '@goodboy/types';

type Params = {
  readonly runId: ProviderRunId;
};

export const cancelChatTurn = async ({ runId }: Params): Promise<void> => {
  await invokeCommand('chat_cancel', { runId }).catch(() => undefined);
};
