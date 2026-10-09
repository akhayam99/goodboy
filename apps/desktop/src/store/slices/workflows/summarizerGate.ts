import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';

const SUMMARIZER_GATE_POLL_MS = 100;
const SUMMARIZER_GATE_TIMEOUT_MS = 60_000;

type SummarizerGateParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const waitForSessionSummarizer = async ({
  get,
  sessionId,
}: SummarizerGateParams): Promise<void> => {
  const deadline = Date.now() + SUMMARIZER_GATE_TIMEOUT_MS;
  while (get().summarizerStatus[sessionId]?.status === 'running') {
    if (Date.now() >= deadline) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, SUMMARIZER_GATE_POLL_MS);
    });
  }
};
