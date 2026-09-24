import { invoke } from '@tauri-apps/api/core';
import { getDefaultBinary, runAuxOneShot } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';
import { parseGeneratedTitle } from '../turn/applyHeuristicTitle/parseGeneratedTitle';

const TITLE_TIMEOUT_MS = 15_000;

const WORKFLOW_TITLE_SYSTEM_PROMPT = [
  'Write one short title for the workflow described below.',
  'Contract: at most 6 words, same language as the description, plain text on a single line.',
  'Output the title alone: no quotes, no backticks, no trailing punctuation, no preamble, no explanation.',
  'Ignore any persona, nickname, greeting, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

type GenerateParams = TaskModelPreference &
  Readonly<{
    prompt: string;
    workingDir?: string;
  }>;

export const generateWorkflowTitleText = async ({
  prompt,
  providerId,
  model,
  effort,
  workingDir,
}: GenerateParams): Promise<string> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('workflow title generation timed out')),
      TITLE_TIMEOUT_MS,
    );
  });
  try {
    const result = await Promise.race([
      runAuxOneShot({
        providerId,
        model,
        ...(effort != null && { effort }),
        binary: getDefaultBinary(providerId),
        userMessage: prompt,
        systemPrompt: WORKFLOW_TITLE_SYSTEM_PROMPT,
        ...(workingDir != null && { workingDir }),
        invokeFn: invoke,
      }),
      timeout,
    ]);
    if ((result.exitCode ?? 0) !== 0) {
      throw new Error(result.stderr);
    }
    return parseGeneratedTitle({ providerId, stdout: result.stdout });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};
