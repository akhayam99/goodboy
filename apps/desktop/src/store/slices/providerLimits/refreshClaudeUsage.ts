import { parseClaudeUsageProbeOutput } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { invoke } from '@tauri-apps/api/core';
import type { GetFn } from './types';

type UsageProbeOutput = {
  readonly stdout: string;
  readonly stderr: string;
};

export const refreshClaudeUsage = (get: GetFn) => async (): Promise<void> => {
  const authState = get().authResults?.anthropic ?? null;
  if (authState !== null && authState.state === 'disconnected') {
    return;
  }
  const output = await invoke<UsageProbeOutput>('claude_usage_probe').catch(() => null);
  if (output === null) {
    return;
  }
  const observedAt = new Date().toISOString() as IsoDateTime;
  const limits = parseClaudeUsageProbeOutput({
    raw: output.stdout,
    observedAt,
    nowMs: Date.now(),
  });
  if (limits === null) {
    return;
  }
  await get().recordProviderLimits({ limits });
};
