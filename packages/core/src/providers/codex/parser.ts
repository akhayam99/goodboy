import type { IsoDateTime, ProviderRunId, TurnEvent } from '@kay-am/types';

export interface ParseContext {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

// Codex CLI emits NDJSON when run with --json flag.
// Documented event types from openai/codex CLI source:
//   message        — assistant/user turn with content blocks
//   function_call  — tool invocation
//   function_call_output — tool result
//   reasoning      — internal chain-of-thought (skipped, not surfaced)
//   error          — terminal error payload
// The CLI does NOT expose token counts; usage event emits zeros.

const KNOWN_TYPES = new Set([
  'message',
  'function_call',
  'function_call_output',
  'reasoning',
  'error',
]);

interface MessageBlock {
  readonly type: string;
  readonly text?: string;
}

interface MessagePayload {
  readonly role?: string;
  readonly content?: ReadonlyArray<MessageBlock>;
}

interface FunctionCallPayload {
  readonly call_id?: string;
  readonly name?: string;
  readonly arguments?: string;
}

interface FunctionCallOutputPayload {
  readonly call_id?: string;
  readonly output?: unknown;
  readonly is_error?: boolean;
}

const FILE_WRITE_FNS: ReadonlySet<string> = new Set([
  'write_file',
  'create_file',
  'overwrite_file',
]);
const FILE_EDIT_FNS: ReadonlySet<string> = new Set([
  'str_replace_editor',
  'edit_file',
  'patch_file',
]);

function detectFileEdit(
  name: string,
  rawArgs: string,
): { path: string; editType: 'create' | 'modify' } | null {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>;
  } catch {
    return null;
  }
  const path =
    typeof args.path === 'string'
      ? args.path
      : typeof args.file_path === 'string'
        ? args.file_path
        : null;
  if (!path) return null;
  if (FILE_WRITE_FNS.has(name)) return { path, editType: 'create' };
  if (FILE_EDIT_FNS.has(name)) return { path, editType: 'modify' };
  return null;
}

export function parseJsonLine(line: string, ctx: ParseContext): ReadonlyArray<TurnEvent> {
  const trimmed = line.trim();
  if (trimmed.length === 0) return [];

  let payload: { type?: string } & Record<string, unknown>;
  try {
    payload = JSON.parse(trimmed) as { type?: string } & Record<string, unknown>;
  } catch {
    return [];
  }

  const at = ctx.now();
  const type = payload.type;

  switch (type) {
    case 'message': {
      const msg = payload as MessagePayload & { type: string };
      if (msg.role !== 'assistant') return [];
      const blocks = msg.content ?? [];
      const events: TurnEvent[] = [];
      for (const block of blocks) {
        if (
          (block.type === 'output_text' || block.type === 'text') &&
          typeof block.text === 'string' &&
          block.text.length > 0
        ) {
          events.push({ kind: 'assistant_text', runId: ctx.runId, delta: block.text, at });
        }
      }
      return events;
    }

    case 'function_call': {
      const fc = payload as FunctionCallPayload & { type: string };
      if (!fc.call_id || !fc.name) return [];
      const rawArgs = typeof fc.arguments === 'string' ? fc.arguments : '{}';
      let parsedInput: unknown;
      try {
        parsedInput = JSON.parse(rawArgs);
      } catch {
        parsedInput = rawArgs;
      }
      const events: TurnEvent[] = [];
      events.push({
        kind: 'tool_call_start',
        runId: ctx.runId,
        toolUseId: fc.call_id,
        toolName: fc.name,
        input: parsedInput,
        at,
      });
      const edit = detectFileEdit(fc.name, rawArgs);
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

    case 'function_call_output': {
      const fco = payload as FunctionCallOutputPayload & { type: string };
      if (!fco.call_id) return [];
      return [
        {
          kind: 'tool_call_end',
          runId: ctx.runId,
          toolUseId: fco.call_id,
          output: fco.output ?? null,
          isError: fco.is_error === true,
          at,
        },
      ];
    }

    case 'reasoning':
      return [];

    case 'error': {
      const msg = typeof payload.message === 'string' ? payload.message : JSON.stringify(payload);
      return [{ kind: 'error', runId: ctx.runId, message: msg, at }];
    }

    default:
      if (typeof type === 'string' && !KNOWN_TYPES.has(type)) {
        if (process.env['NODE_ENV'] !== 'production') {
          console.warn(`[codex-adapter] unknown json payload type: ${type}`);
        }
        ctx.onUnknown?.(type, payload);
        return [
          {
            kind: 'unknown_payload',
            runId: ctx.runId,
            adapter: 'codex',
            payloadType: type,
            raw: payload,
            at,
          },
        ];
      }
      return [];
  }
}
