import type { IsoDateTime, ProviderRunId, ProviderUsage, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';

export type ParseContext = {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

type Payload = {
  readonly event?: unknown;
  readonly init?: unknown;
  readonly step_update?: unknown;
  readonly result?: unknown;
} & Record<string, unknown>;

type UnknownValueParams = {
  readonly value: unknown;
};

type TryParseJsonParams = {
  readonly line: string;
};

type ReadNumberParams = {
  readonly payload: Readonly<Record<string, unknown>> | undefined;
  readonly key: string;
};

type BuildUsageParams = {
  readonly raw: Readonly<Record<string, unknown>> | undefined;
};

type BuildErrorMessageParams = {
  readonly payload: Payload;
  readonly result: Readonly<Record<string, unknown>> | undefined;
};

const toRecord = ({ value }: UnknownValueParams): Record<string, unknown> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const tryParseJson = ({ line }: TryParseJsonParams): Payload | null => {
  if (!line.startsWith('{') && !line.startsWith('[')) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as Payload;
  } catch {
    return null;
  }
};

const readNumber = ({ payload, key }: ReadNumberParams): number | undefined => {
  const value = payload?.[key];
  if (typeof value !== 'number') {
    return undefined;
  }
  return value;
};

const buildUsage = ({ raw }: BuildUsageParams): ProviderUsage => {
  const inputTokens = readNumber({ payload: raw, key: 'input_tokens' }) ?? 0;
  const outputTokens = readNumber({ payload: raw, key: 'output_tokens' }) ?? 0;
  const totalTokens = readNumber({ payload: raw, key: 'total_tokens' });
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: readNumber({ payload: raw, key: 'cache_read_tokens' }) ?? 0,
    cacheCreationInputTokens: 0,
    contextTokens: totalTokens ?? inputTokens + outputTokens,
    estimatedCostUsd: 0,
  };
};

const findErrorText = ({ value }: UnknownValueParams): string | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  const record = toRecord({ value });
  if (record === undefined) {
    return undefined;
  }

  const candidates = [record['message'], record['error'], record['error_message'], record['text']];
  for (const candidate of candidates) {
    const text = findErrorText({ value: candidate });
    if (text !== undefined) {
      return text;
    }
  }
  return undefined;
};

const buildErrorMessage = ({ payload, result }: BuildErrorMessageParams): string => {
  const status = result?.['status'];
  const errorText =
    findErrorText({ value: result?.['error'] }) ??
    findErrorText({ value: result?.['error_message'] }) ??
    findErrorText({ value: result?.['message'] });
  const detail = errorText ?? JSON.stringify(payload);
  if (typeof status !== 'string' || status.length === 0) {
    return detail;
  }
  return `${status}: ${detail}`;
};

export const parseJsonLine = (line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const at = ctx.now();
  const payload = tryParseJson({ line: trimmed });

  if (payload === null) {
    return [{ kind: 'assistant_text', runId: ctx.runId, delta: `${trimmed}\n`, at }];
  }

  const event = payload.event;
  switch (event) {
    case 'init': {
      const conversationId = payload['conversation_id'];
      if (typeof conversationId !== 'string' || conversationId.length === 0) {
        return [];
      }
      return [
        {
          kind: 'provider_session_init',
          runId: ctx.runId,
          providerSessionId: conversationId,
          provider: 'gemini',
          at,
        },
      ];
    }

    case 'step_update': {
      const stepUpdate = toRecord({ value: payload.step_update });
      if (stepUpdate?.['step_type'] !== 'agent_response') {
        return [];
      }
      const delta = stepUpdate['text_delta'];
      if (typeof delta !== 'string' || delta.length === 0) {
        return [];
      }
      return [{ kind: 'assistant_text', runId: ctx.runId, delta, at }];
    }

    case 'result': {
      const result = toRecord({ value: payload.result });
      const rawUsage = toRecord({ value: result?.['usage'] });
      const events: TurnEvent[] = [
        { kind: 'usage', runId: ctx.runId, usage: buildUsage({ raw: rawUsage }), at },
      ];
      if (result?.['status'] !== 'SUCCESS') {
        events.push({
          kind: 'error',
          runId: ctx.runId,
          message: buildErrorMessage({ payload, result }),
          at,
        });
      }
      return events;
    }

    default:
      if (typeof event !== 'string') {
        return [];
      }
      devWarn(`[gemini-adapter] unknown json payload event: ${event}`);
      ctx.onUnknown?.(event, payload);
      return [
        {
          kind: 'unknown_payload',
          runId: ctx.runId,
          adapter: 'gemini',
          payloadType: event,
          raw: payload,
          at,
        },
      ];
  }
};
