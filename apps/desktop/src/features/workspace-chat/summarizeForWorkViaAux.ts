import { invokeCommand } from '../../shared/lib/invokeCommand';
import { extractAuxOutput, getDefaultBinary, runAuxOneShot } from '@goodboy/core';
import type { SummarizeForWorkParams } from './chatBackend';

export const summarizeForWorkViaAux = async ({
  provider,
  model,
  systemPrompt,
  userMessage,
}: SummarizeForWorkParams): Promise<string> => {
  const result = await runAuxOneShot({
    providerId: provider,
    model,
    binary: getDefaultBinary(provider),
    userMessage,
    systemPrompt,
    invokeFn: invokeCommand,
  });
  if ((result.exitCode ?? 0) !== 0) {
    throw new Error(result.stderr.trim() === '' ? 'The summary did not finish' : result.stderr);
  }
  return extractAuxOutput({ providerId: provider, stdout: result.stdout }).text;
};
