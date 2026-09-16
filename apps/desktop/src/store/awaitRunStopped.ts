import type { ProviderRunId } from '@goodboy/types';
import { listLiveRunIds } from '../features/chat/turn';

const RUN_STOP_ATTEMPTS = 20;
const RUN_STOP_INTERVAL_MS = 100;

type AwaitRunStoppedParams = {
  readonly runId: ProviderRunId;
};

export const awaitRunStopped = async ({ runId }: AwaitRunStoppedParams): Promise<boolean> => {
  for (let attempt = 0; attempt < RUN_STOP_ATTEMPTS; attempt += 1) {
    const live = await listLiveRunIds();
    if (!live.has(runId)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, RUN_STOP_INTERVAL_MS));
  }
  const live = await listLiveRunIds();
  return !live.has(runId);
};
