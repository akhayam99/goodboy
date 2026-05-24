import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';

export interface ParseContext {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

export interface AnthropicEnvelopeParserOptions {
  readonly adapter: string;
  readonly logTag: string;
}

const KNOWN_PAYLOAD_TYPES: ReadonlySet<string> = new Set(['system', 'assistant', 'user', 'result']);

interface AssistantMessage {
  readonly content?: ReadonlyArray<AssistantContentBlock>;
}

type AssistantContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: unknown;
    };

interface ToolResultBlock {
  readonly tool_use_id: string;
  readonly content?: unknown;
  readonly is_error?: boolean;
}

interface UserMessage {
  readonly content?: ReadonlyArray<ToolResultBlock | { type: string }>;
}

// Anthropic's own stream-json uses snake_case (`input_tokens`, `cache_read_input_tokens`).
// Cursor's stream-json — which is otherwise envelope-compatible — uses camelCase
// (`inputTokens`, `cacheReadTokens`, `cacheWriteTokens`).
// Accept both forms so the shared parser can serve both adapters.
//
// Cache-write split (5m vs 1h TTL): Anthropic reports either a flat
// `cache_creation_input_tokens` (treated as 5m default) or a nested object
// `cache_creation: { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens }`
// when both TTLs were used in the same turn.
interface NestedCacheCreation {
  readonly ephemeral_5m_input_tokens?: number;
  readonly ephemeral_1h_input_tokens?: number;
}
interface UsagePayload {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
  readonly cache_creation?: NestedCacheCreation;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
}

const FILE_EDIT_TOOLS: ReadonlySet<string> = new Set([
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookEdit',
]);

function fileEditFromInput(
  toolName: string,
  input: unknown,
): { path: string; editType: 'create' | 'modify' | 'delete' } | null {
  if (!FILE_EDIT_TOOLS.has(toolName)) return null;
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  const path = typeof record.file_path === 'string' ? record.file_path : null;
  if (!path) return null;
  const editType: 'create' | 'modify' | 'delete' = toolName === 'Write' ? 'create' : 'modify';
  return { path, editType };
}

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'tool_use_id' in block &&
    typeof (block as { tool_use_id: unknown }).tool_use_id === 'string'
  );
}

export function parseAnthropicEnvelopeLine(
  line: string,
  ctx: ParseContext,
  opts: AnthropicEnvelopeParserOptions,
): ReadonlyArray<TurnEvent> {
  const trimmed = line.trim();
  if (trimmed.length === 0) return [];

  let payload: { type?: string } & Record<string, unknown>;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const at = ctx.now();

  switch (payload.type) {
    case 'assistant':
      return parseAssistant(payload.message as AssistantMessage | undefined, ctx, at);

    case 'user':
      return parseUser(payload.message as UserMessage | undefined, ctx, at);

    case 'result': {
      const usage = (payload.usage as UsagePayload | undefined) ?? {};
      const input = usage.input_tokens ?? usage.inputTokens;
      const output = usage.output_tokens ?? usage.outputTokens;
      const cached = usage.cache_read_input_tokens ?? usage.cacheReadTokens;
      // Prefer nested split when present (both TTLs used in same turn).
      // Otherwise fall back to flat `cache_creation_input_tokens` (5m default)
      // or Cursor's `cacheWriteTokens` (also 5m by convention).
      const nested = usage.cache_creation;
      const cacheWrite5m =
        nested?.ephemeral_5m_input_tokens ??
        usage.cache_creation_input_tokens ??
        usage.cacheWriteTokens;
      const cacheWrite1h = nested?.ephemeral_1h_input_tokens;
      const events: TurnEvent[] = [];
      if (typeof input === 'number' || typeof output === 'number') {
        events.push({
          kind: 'usage',
          runId: ctx.runId,
          usage: {
            inputTokens: input ?? 0,
            outputTokens: output ?? 0,
            cachedInputTokens: cached ?? 0,
            cacheCreation5mTokens: cacheWrite5m ?? 0,
            cacheCreation1hTokens: cacheWrite1h ?? 0,
            estimatedCostUsd: 0,
          },
          at,
        });
      }
      const subtype = payload.subtype as string | undefined;
      if (subtype === 'success') {
        events.push({ kind: 'done', runId: ctx.runId, at });
      } else if (typeof payload.error === 'string') {
        events.push({ kind: 'error', runId: ctx.runId, message: payload.error, at });
      } else {
        events.push({ kind: 'done', runId: ctx.runId, at });
      }
      return events;
    }

    case 'system': {
      // Claude stream-json emits `{"type":"system","subtype":"init","session_id":"..."}`.
      // Capture the session id so it can be threaded back via --resume; ignore
      // other system subtypes for now.
      const subtype = payload.subtype as string | undefined;
      const sessionId = payload.session_id;
      if (subtype === 'init' && typeof sessionId === 'string' && sessionId.length > 0) {
        return [
          {
            kind: 'provider_session_init',
            runId: ctx.runId,
            providerSessionId: sessionId,
            at,
          },
        ];
      }
      return [];
    }

    default:
      if (typeof payload.type === 'string' && !KNOWN_PAYLOAD_TYPES.has(payload.type)) {
        devWarn(`[${opts.logTag}] unknown stream-json payload type: ${payload.type}`);
        ctx.onUnknown?.(payload.type, payload);
        return [
          {
            kind: 'unknown_payload',
            runId: ctx.runId,
            adapter: opts.adapter,
            payloadType: payload.type,
            raw: payload,
            at,
          },
        ];
      }
      return [];
  }
}

function parseAssistant(
  message: AssistantMessage | undefined,
  ctx: ParseContext,
  at: IsoDateTime,
): ReadonlyArray<TurnEvent> {
  const blocks = message?.content ?? [];
  const events: TurnEvent[] = [];

  for (const block of blocks) {
    if (block.type === 'text' && block.text.length > 0) {
      events.push({ kind: 'assistant_text', runId: ctx.runId, delta: block.text, at });
    } else if (block.type === 'tool_use') {
      events.push({
        kind: 'tool_call_start',
        runId: ctx.runId,
        toolUseId: block.id,
        toolName: block.name,
        input: block.input,
        at,
      });
      const edit = fileEditFromInput(block.name, block.input);
      if (edit) {
        events.push({
          kind: 'file_edit',
          runId: ctx.runId,
          path: edit.path,
          editType: edit.editType,
          at,
        });
      }
    }
  }
  return events;
}

function parseUser(
  message: UserMessage | undefined,
  ctx: ParseContext,
  at: IsoDateTime,
): ReadonlyArray<TurnEvent> {
  const blocks = message?.content ?? [];
  const events: TurnEvent[] = [];
  for (const block of blocks) {
    if (isToolResultBlock(block)) {
      events.push({
        kind: 'tool_call_end',
        runId: ctx.runId,
        toolUseId: block.tool_use_id,
        output: block.content ?? null,
        isError: block.is_error === true,
        at,
      });
    }
  }
  return events;
}
