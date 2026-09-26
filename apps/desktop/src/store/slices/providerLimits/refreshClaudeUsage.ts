import { parseClaudeUsageProbeOutput } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { invoke } from '@tauri-apps/api/core';
import { markProbe } from './markProbe';
import type { GetFn, SetFn } from './types';

type UsageProbeOutput = {
  readonly stdout: string;
  readonly stderr: string;
};

export const refreshClaudeUsage = (set: SetFn, get: GetFn) => async (): Promise<void> => {
  const authState = get().authResults?.anthropic ?? null;
  if (authState !== null && authState.state === 'disconnected') {
    return;
  }
  markProbe({ set, providerId: 'anthropic', outcome: 'checking' });
  const output = await invoke<UsageProbeOutput>('claude_usage_probe').catch(() => null);
  const observedAt = new Date().toISOString() as IsoDateTime;
  const limits =
    output == null
      ? null
      : parseClaudeUsageProbeOutput({ raw: output.stdout, observedAt, nowMs: Date.now() });
  if (limits === null) {
    markProbe({ set, providerId: 'anthropic', outcome: 'failed' });
    return;
  }
  markProbe({ set, providerId: 'anthropic', outcome: 'ok' });
  await get().recordProviderLimits({ limits });
};
