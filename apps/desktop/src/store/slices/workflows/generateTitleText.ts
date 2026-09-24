import { invoke } from '@tauri-apps/api/core';
import { getDefaultBinary, runAuxOneShot } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';
import { parseGeneratedTitle } from '../turn/applyHeuristicTitle/parseGeneratedTitle';

const TITLE_TIMEOUT_MS = 15_000;

type Params = TaskModelPreference &
  Readonly<{
    prompt: string;
    systemPrompt: string;
    workingDir?: string;
  }>;

export const generateTitleText = async ({
  prompt,
  systemPrompt,
  providerId,
  model,
  effort,
  workingDir,
}: Params): Promise<string> => {
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
        systemPrompt,
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
