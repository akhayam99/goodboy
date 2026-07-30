import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';
import { createPermissionRequestEvent } from '../../permissions/events';
import { blockBoundaryPrefix, resetTextBoundary } from './text-boundary';

export type ParseContext = {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
  lastAssistantContextTokens?: number;
};

export type AnthropicEnvelopeParserOptions = {
  readonly adapter: string;
  readonly logTag: string;
};

const KNOWN_PAYLOAD_TYPES: ReadonlySet<string> = new Set(['system', 'assistant', 'user', 'result']);

type AssistantMessage = {
  readonly content?: ReadonlyArray<AssistantContentBlock>;
  readonly usage?: UsagePayload;
};

type AssistantContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: unknown;
    };

type ToolResultBlock = {
  readonly tool_use_id: string;
  readonly content?: unknown;
  readonly is_error?: boolean;
};

type UserMessage = {
  readonly content?: ReadonlyArray<ToolResultBlock | { type: string }>;
};

type UsagePayload = {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheCreationInputTokens?: number;
};

type ContextTokenParams = {
  readonly usage: UsagePayload | undefined;
};

const contextTokensFromUsage = ({ usage }: ContextTokenParams): number | null => {
  if (usage == null) {
    return null;
  }
  const input = usage.input_tokens ?? usage.inputTokens;
  const output = usage.output_tokens ?? usage.outputTokens;
  const cached = usage.cache_read_input_tokens ?? usage.cacheReadTokens;
  const cacheCreation = usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens;
  if (
    typeof input !== 'number' &&
    typeof output !== 'number' &&
    typeof cached !== 'number' &&
    typeof cacheCreation !== 'number'
  ) {
    return null;
  }
  return (input ?? 0) + (output ?? 0) + (cached ?? 0) + (cacheCreation ?? 0);
};

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
  if (!FILE_EDIT_TOOLS.has(toolName)) {
    return null;
  }
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const record = input as Record<string, unknown>;
  const path = typeof record.file_path === 'string' ? record.file_path : null;
  if (!path) {
    return null;
  }
  const editType: 'create' | 'modify' | 'delete' = toolName === 'Write' ? 'create' : 'modify';
  return { path, editType };
}

type PermissionDenial = {
  readonly tool_name: string;
  readonly tool_use_id: string;
  readonly tool_input?: unknown;
};

const isPermissionDenial = (value: unknown): value is PermissionDenial => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.tool_name === 'string' &&
    record.tool_name !== '' &&
    typeof record.tool_use_id === 'string' &&
    record.tool_use_id !== ''
  );
};

type Params = {
  readonly denials: unknown;
  readonly runId: ProviderRunId;
  readonly at: IsoDateTime;
};

const permissionRequestsFromDenials = ({
  denials,
  runId,
  at,
}: Params): ReadonlyArray<TurnEvent> => {
  if (!Array.isArray(denials)) {
    return [];
  }
  const entries: ReadonlyArray<unknown> = denials;
  return entries.filter(isPermissionDenial).map((denial) =>
    createPermissionRequestEvent({
      runId,
      toolUseId: denial.tool_use_id,
      toolName: denial.tool_name,
      input: denial.tool_input ?? null,
      at,
    }),
  );
};

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'tool_use_id' in block &&
    typeof (block as { tool_use_id: unknown }).tool_use_id === 'string'
  );
}

export const parseAnthropicEnvelopeLine = (
  line: string,
  ctx: ParseContext,
  opts: AnthropicEnvelopeParserOptions,
): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }

  let payload: { type?: string } & Record<string, unknown>;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const at = ctx.now();

  switch (payload.type) {
    case 'assistant': {
      const message = payload.message as AssistantMessage | undefined;
      const contextTokens = contextTokensFromUsage({ usage: message?.usage });
      if (contextTokens != null) {
        ctx.lastAssistantContextTokens = contextTokens;
      }
      return parseAssistant(message, ctx, at);
    }

    case 'user':
      return parseUser(payload.message as UserMessage | undefined, ctx, at);

    case 'result': {
      const usage = (payload.usage as UsagePayload | undefined) ?? {};
      const input = usage.input_tokens ?? usage.inputTokens;
      const output = usage.output_tokens ?? usage.outputTokens;
      const cached = usage.cache_read_input_tokens ?? usage.cacheReadTokens;
      const cacheCreation = usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens;
      const contextTokens = ctx.lastAssistantContextTokens;
      delete ctx.lastAssistantContextTokens;
      const events: TurnEvent[] = [];
      if (
        typeof input === 'number' ||
        typeof output === 'number' ||
        typeof cached === 'number' ||
        typeof cacheCreation === 'number' ||
        contextTokens != null
      ) {
        events.push({
          kind: 'usage',
          runId: ctx.runId,
          usage: {
            inputTokens: input ?? 0,
            outputTokens: output ?? 0,
            cachedInputTokens: cached ?? 0,
            cacheCreationInputTokens: cacheCreation ?? 0,
            ...(contextTokens != null && { contextTokens }),
            estimatedCostUsd: 0,
          },
          at,
        });
      }
      events.push(
        ...permissionRequestsFromDenials({
          denials: payload.permission_denials,
          runId: ctx.runId,
          at,
        }),
      );
      const subtype = payload.subtype as string | undefined;
      if (subtype === 'success') {
        events.push({ kind: 'done', runId: ctx.runId, at });
      } else if (typeof payload.error === 'string') {
        events.push({ kind: 'error', runId: ctx.runId, message: payload.error, at });
      } else {
        events.push({ kind: 'done', runId: ctx.runId, at });
      }
      resetTextBoundary({ runId: ctx.runId });
      return events;
    }

    case 'system': {
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
};

function parseAssistant(
  message: AssistantMessage | undefined,
  ctx: ParseContext,
  at: IsoDateTime,
): ReadonlyArray<TurnEvent> {
  const blocks = message?.content ?? [];
  const events: TurnEvent[] = [];

  for (const block of blocks) {
    if (block.type === 'text' && block.text.length > 0) {
      const prefix = blockBoundaryPrefix({ runId: ctx.runId, text: block.text });
      events.push({
        kind: 'assistant_text',
        runId: ctx.runId,
        delta: `${prefix}${block.text}`,
        at,
      });
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
