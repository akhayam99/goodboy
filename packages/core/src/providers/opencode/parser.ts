import type { IsoDateTime, ProviderRunId, TurnEvent } from '@kay-am/types';

export interface ParseContext {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

// OpenCode v1.14 NDJSON schema (captured live, May 2026):
//   step_start    { sessionID, part: { id, messageID, type: 'step-start' } }
//   text          { sessionID, part: { id, messageID, type: 'text', text } }
//   step_finish   { sessionID, part: { id, messageID, type: 'step-finish', reason,
//                                       tokens: { total, input, output, reasoning,
//                                                 cache: { write, read } },
//                                       cost } }
//   tool          { sessionID, part: { id, messageID, type: 'tool', tool, callID,
//                                       state: { status, input, output, ... } } }
//   error         { sessionID, error: { name, data } }
const KNOWN_TYPES = new Set(['step_start', 'step_finish', 'text', 'tool', 'error']);

interface TextPart {
  readonly id?: string;
  readonly text?: string;
}

interface ToolState {
  readonly status?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
}

interface ToolPart {
  readonly id?: string;
  readonly callID?: string;
  readonly tool?: string;
  readonly state?: ToolState;
}

interface StepFinishPart {
  readonly tokens?: {
    readonly input?: number;
    readonly output?: number;
    readonly reasoning?: number;
    readonly cache?: { readonly read?: number; readonly write?: number };
  };
  readonly cost?: number;
}

const FILE_EDIT_TOOLS: ReadonlySet<string> = new Set(['write', 'edit', 'patch']);

function fileEditFromTool(
  tool: string,
  input: unknown,
): { path: string; editType: 'create' | 'modify' } | null {
  if (!FILE_EDIT_TOOLS.has(tool.toLowerCase())) return null;
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  const path =
    typeof record['filePath'] === 'string'
      ? (record['filePath'] as string)
      : typeof record['file_path'] === 'string'
        ? (record['file_path'] as string)
        : typeof record['path'] === 'string'
          ? (record['path'] as string)
          : null;
  if (!path) return null;
  const editType: 'create' | 'modify' = tool.toLowerCase() === 'write' ? 'create' : 'modify';
  return { path, editType };
}

export function parseOpenCodeLine(line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> {
  const trimmed = line.trim();
  if (trimmed.length === 0) return [];

  let payload: { type?: string; sessionID?: string } & Record<string, unknown>;
  try {
    payload = JSON.parse(trimmed) as { type?: string; sessionID?: string } & Record<
      string,
      unknown
    >;
  } catch {
    return [];
  }

  const at = ctx.now();
  const type = payload.type;

  switch (type) {
    case 'step_start': {
      const sessionID = payload.sessionID;
      if (typeof sessionID !== 'string' || sessionID.length === 0) return [];
      return [
        {
          kind: 'provider_session_init',
          runId: ctx.runId,
          providerSessionId: sessionID,
          at,
        },
      ];
    }

    case 'text': {
      const part = payload['part'] as TextPart | undefined;
      const text = part?.text;
      if (typeof text !== 'string' || text.length === 0) return [];
      return [{ kind: 'assistant_text', runId: ctx.runId, delta: text, at }];
    }

    case 'tool': {
      const part = payload['part'] as ToolPart | undefined;
      const callId = part?.callID ?? part?.id;
      const toolName = part?.tool;
      const state = part?.state;
      if (typeof callId !== 'string' || typeof toolName !== 'string') return [];
      const status = state?.status;
      if (status === 'running' || status === 'pending') {
        const events: TurnEvent[] = [
          {
            kind: 'tool_call_start',
            runId: ctx.runId,
            toolUseId: callId,
            toolName,
            input: state?.input ?? null,
            at,
          },
        ];
        const edit = fileEditFromTool(toolName, state?.input);
        if (edit) {
          events.push({
            kind: 'file_edit',
            runId: ctx.runId,
            path: edit.path,
            editType: edit.editType,
            at,
          });
        }
        return events;
      }
      if (status === 'completed' || status === 'error') {
        return [
          {
            kind: 'tool_call_end',
            runId: ctx.runId,
            toolUseId: callId,
            output: state?.output ?? state?.error ?? null,
            isError: status === 'error',
            at,
          },
        ];
      }
      return [];
    }

    case 'step_finish': {
      const part = payload['part'] as StepFinishPart | undefined;
      const tokens = part?.tokens;
      return [
        {
          kind: 'usage',
          runId: ctx.runId,
          usage: {
            inputTokens: tokens?.input ?? 0,
            outputTokens: (tokens?.output ?? 0) + (tokens?.reasoning ?? 0),
            cachedInputTokens: tokens?.cache?.read ?? 0,
            estimatedCostUsd: part?.cost ?? 0,
          },
          at,
        },
      ];
    }

    case 'error': {
      const err = payload['error'] as { name?: string; data?: { message?: string } } | undefined;
      const msg =
        err?.data?.message ??
        err?.name ??
        (typeof payload['message'] === 'string'
          ? (payload['message'] as string)
          : JSON.stringify(payload));
      return [{ kind: 'error', runId: ctx.runId, message: msg, at }];
    }

    default:
      if (typeof type === 'string' && !KNOWN_TYPES.has(type)) {
        if (process.env['NODE_ENV'] !== 'production') {
          console.warn(`[opencode-adapter] unknown json payload type: ${type}`);
        }
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
}
