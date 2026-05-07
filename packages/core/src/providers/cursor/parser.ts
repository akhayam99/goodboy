import type { IsoDateTime, ProviderRunId, TurnEvent } from '@kay-am/types';

export interface ParseContext {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

// cursor-agent stream-json uses the same envelope shape as claude's stream-json:
// { type: 'assistant' | 'user' | 'result' | 'system', ... }
// This is the same Anthropic message format (cursor wraps model calls via their API).
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

interface UsagePayload {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
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

export function parseCursorStreamLine(line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> {
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
      const events: TurnEvent[] = [];
      if (typeof usage.input_tokens === 'number' || typeof usage.output_tokens === 'number') {
        events.push({
          kind: 'usage',
          runId: ctx.runId,
          usage: {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            cachedInputTokens: usage.cache_read_input_tokens ?? 0,
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

    case 'system':
      return [];

    default:
      if (typeof payload.type === 'string' && !KNOWN_PAYLOAD_TYPES.has(payload.type)) {
        ctx.onUnknown?.(payload.type, payload);
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
