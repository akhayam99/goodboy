import { invoke } from '@tauri-apps/api/core';
import { fallbackStepOutputSummary, summarizeStepOutput } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';
import { formatError } from '../shared/lib/errors';

export const SUMMARY_TIMEOUT_MS = 15_000;

type Params = {
  readonly output: string;
  readonly taskModel: TaskModelPreference;
  readonly workingDir?: string;
  readonly expectedOutput?: string;
};

export type SummarizeAgentOutputResult = {
  readonly summary: string;
  readonly degraded: boolean;
  readonly error?: string;
};

export const summarizeAgentOutput = async ({
  output,
  taskModel,
  workingDir,
  expectedOutput,
}: Params): Promise<SummarizeAgentOutputResult> => {
  const runId = crypto.randomUUID();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('step output summarization timed out'));
      void Promise.resolve(invoke('summarize_cancel', { runId })).catch(() => undefined);
    }, SUMMARY_TIMEOUT_MS);
  });

  try {
    const summary = await Promise.race([
      summarizeStepOutput({
        ...taskModel,
        invokeFn: invoke,
        output,
        runId,
        ...(workingDir != null && { workingDir }),
        ...(expectedOutput != null && expectedOutput !== '' && { expectedOutput }),
      }),
      timeout,
    ]);
    return { summary, degraded: false };
  } catch (error) {
    const message = formatError(error);
    console.warn(`[step-output] summarization failed, using deterministic fallback: ${message}`);
    return { summary: fallbackStepOutputSummary({ output }), degraded: true, error: message };
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};
