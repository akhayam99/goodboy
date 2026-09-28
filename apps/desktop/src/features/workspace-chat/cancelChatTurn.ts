import { invoke } from '@tauri-apps/api/core';
import type { ProviderRunId } from '@goodboy/types';

type Params = {
  readonly runId: ProviderRunId;
};

export const cancelChatTurn = async ({ runId }: Params): Promise<void> => {
  await invoke('chat_cancel', { runId }).catch(() => undefined);
};
