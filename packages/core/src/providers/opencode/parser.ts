import type { IsoDateTime, ProviderRunId, ProviderUsage, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';

export type ParseContext = {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

const KNOWN_TYPES = new Set(['message', 'tool_use', 'tool_result', 'usage', 'error', 'done']);

type UsagePayload = {
  readonly input_tokens?: number;
  readonly cached_input_tokens?: number;
  readonly output_tokens?: number;
};

type MessagePayload = {
  readonly role?: string;
  readonly content?: string;
};

type ToolUsePayload = {
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
};

type ToolResultPayload = {
  readonly id?: string;
  readonly output?: unknown;
  readonly is_error?: boolean;
};

type OpenCodePayload = {
  readonly type?: string;
  readonly message?: MessagePayload;
  readonly tool_use?: ToolUsePayload;
  readonly tool_result?: ToolResultPayload;
  readonly usage?: UsagePayload;
  readonly error?: string;
  readonly [k: string]: unknown;
};

export const parseJsonLine = (line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }

  let payload: OpenCodePayload;
  try {
    payload = JSON.parse(trimmed) as OpenCodePayload;
  } catch {
    return [];
  }

  const at = ctx.now();
  const type = payload.type;

  switch (type) {
    case 'message': {
      const message = payload.message;
      if (
        message?.role === 'assistant' &&
        typeof message.content === 'string' &&
        message.content.length > 0
      ) {
        return [{ kind: 'assistant_text', runId: ctx.runId, delta: message.content, at }];
      }
      if (
        message?.role === 'user' &&
        typeof message.content === 'string' &&
        message.content.length > 0
      ) {
        return [{ kind: 'user_text', runId: ctx.runId, text: message.content, at }];
      }
      return [];
    }

    case 'tool_use': {
      const toolUse = payload.tool_use;
      if (toolUse?.id && toolUse.name) {
        return [
          {
            kind: 'tool_call_start',
            runId: ctx.runId,
            toolUseId: toolUse.id,
            toolName: toolUse.name,
            input: toolUse.input ?? {},
            at,
          },
        ];
      }
      return [];
    }

    case 'tool_result': {
      const toolResult = payload.tool_result;
      if (toolResult?.id) {
        return [
          {
            kind: 'tool_call_end',
            runId: ctx.runId,
            toolUseId: toolResult.id,
            output: toolResult.output ?? null,
            isError: toolResult.is_error ?? false,
            at,
          },
        ];
      }
      return [];
    }

    case 'usage': {
      const usage = buildUsage(payload.usage);
      return [{ kind: 'usage', runId: ctx.runId, usage, at }];
    }

    case 'error': {
      const msg = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload);
      return [{ kind: 'error', runId: ctx.runId, message: msg, at }];
    }

    case 'done': {
      return [{ kind: 'done', runId: ctx.runId, at }];
    }

    default:
      if (typeof type === 'string' && !KNOWN_TYPES.has(type)) {
        devWarn(`[opencode-adapter] unknown json payload type: ${type}`);
        ctx.onUnknown?.(type, payload);
        return [
          {
            kind: 'unknown_payload',
            runId: ctx.runId,
            adapter: 'opencode',
            payloadType: type,
            raw: payload,
            at,
          },
        ];
      }
      return [];
  }
};

const buildUsage = (raw: UsagePayload | undefined): ProviderUsage => {
  const inputTokens = raw?.input_tokens ?? 0;
  const cachedInputTokens = raw?.cached_input_tokens ?? 0;
  const outputTokens = raw?.output_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    estimatedCostUsd: 0,
  };
};
