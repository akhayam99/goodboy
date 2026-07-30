import type { IsoDateTime, ProviderRunId, ProviderUsage, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';

export type ParseContext = {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

const KNOWN_TYPES = new Set(['response.delta', 'response.completed', 'usage', 'error']);

type UsagePayload = {
  readonly input_tokens?: number;
  readonly cached_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
  readonly output_tokens?: number;
  readonly inputTokens?: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  readonly outputTokens?: number;
};

function buildUsage(raw: UsagePayload | undefined): ProviderUsage {
  const inputTokens = raw?.input_tokens ?? raw?.inputTokens ?? 0;
  const outputTokens = raw?.output_tokens ?? raw?.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: raw?.cached_input_tokens ?? raw?.cachedInputTokens ?? 0,
    cacheCreationInputTokens:
      raw?.cache_creation_input_tokens ?? raw?.cacheCreationInputTokens ?? 0,
    contextTokens: inputTokens + outputTokens,
    estimatedCostUsd: 0,
  };
}

function tryParseJson(line: string): ({ type?: string } & Record<string, unknown>) | null {
  if (!line.startsWith('{') && !line.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(line) as { type?: string } & Record<string, unknown>;
  } catch {
    return null;
  }
}

export const parseJsonLine = (line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const at = ctx.now();
  const payload = tryParseJson(trimmed);

  if (payload === null) {
    return [{ kind: 'assistant_text', runId: ctx.runId, delta: `${trimmed}\n`, at }];
  }

  const type = payload.type;
  switch (type) {
    case 'response.delta': {
      const delta = typeof payload['text'] === 'string' ? (payload['text'] as string) : '';
      if (delta.length === 0) {
        return [];
      }
      return [{ kind: 'assistant_text', runId: ctx.runId, delta, at }];
    }

    case 'response.completed':
      return [];

    case 'usage': {
      const usage = buildUsage(payload['usage'] as UsagePayload | undefined);
      return [{ kind: 'usage', runId: ctx.runId, usage, at }];
    }

    case 'error': {
      const msg =
        typeof payload['message'] === 'string'
          ? (payload['message'] as string)
          : JSON.stringify(payload);
      return [{ kind: 'error', runId: ctx.runId, message: msg, at }];
    }

    default:
      if (typeof type === 'string' && !KNOWN_TYPES.has(type)) {
        devWarn(`[gemini-adapter] unknown json payload type: ${type}`);
        ctx.onUnknown?.(type, payload);
        return [
          {
            kind: 'unknown_payload',
            runId: ctx.runId,
            adapter: 'gemini',
            payloadType: type,
            raw: payload,
            at,
          },
        ];
      }
      return [];
  }
};
