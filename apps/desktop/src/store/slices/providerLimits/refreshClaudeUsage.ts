import { parseClaudeUsageProbeOutput } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { probeLock } from '../providers/probeLock';
import { markProbe } from './markProbe';
import type { GetFn, SetFn } from './types';

type UsageProbeOutput = {
  readonly stdout: string;
  readonly stderr: string;
};

type Params = { readonly set: SetFn; readonly get: GetFn };

export const refreshClaudeUsage =
  ({ set, get }: Params) =>
  (): Promise<void> =>
    probeLock({
      get,
      providerId: 'anthropic',
      kind: 'usage',
      isAutomatic: true,
      run: async () => {
        const authState = get().authResults?.anthropic ?? null;
        if (authState !== null && authState.state === 'disconnected') {
          return;
        }
        markProbe({ set, providerId: 'anthropic', outcome: 'checking' });
        const output = await invokeCommand<UsageProbeOutput>('claude_usage_probe').catch(
          () => null,
        );
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
      },
    });
