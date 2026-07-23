import { invoke } from '@tauri-apps/api/core';
import { fallbackStepOutputSummary, summarizeStepOutput } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';
import { formatError } from '../shared/lib/errors';

const SUMMARY_TIMEOUT_MS = 15_000;

type Params = {
  readonly output: string;
  readonly taskModel: TaskModelPreference;
};

export const summarizeAgentOutput = async ({ output, taskModel }: Params): Promise<string> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('step output summarization timed out')),
      SUMMARY_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([
      summarizeStepOutput({ ...taskModel, invokeFn: invoke, output }),
      timeout,
    ]);
  } catch (error) {
    console.warn(
      `[step-output] summarization failed, using deterministic fallback: ${formatError(error)}`,
    );
    return fallbackStepOutputSummary({ output });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};
