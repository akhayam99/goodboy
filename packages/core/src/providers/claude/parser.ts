import type { TurnEvent } from '@goodboy/types';
import { parseAnthropicEnvelopeLine, type ParseContext } from '../shared/anthropic-envelope-parser';
import { readClaudeRateLimitLine } from '../limits/parseClaudeRateLimitEvent';

export type { ParseContext };

export const parseStreamJsonLine = (line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> => {
  const rateLimit = readClaudeRateLimitLine({ line: line.trim(), observedAt: ctx.now() });
  if (rateLimit !== null) {
    if (rateLimit.limits !== null) {
      ctx.onProviderLimits?.(rateLimit.limits);
    }
    return [];
  }
  return parseAnthropicEnvelopeLine(line, ctx, { adapter: 'anthropic', logTag: 'claude-adapter' });
};
