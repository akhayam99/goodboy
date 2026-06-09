import type { IsoDateTime, ProviderRunId, ProviderUsage, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';

export type ParseContext = {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

// Codex CLI v0.130.0 emits NDJSON when run with `--json`. Schema captured from
// `codex exec --json -m gpt-5.2 -s read-only -C /tmp "..."`:
//   thread.started   { thread_id }
//   turn.started
//   item.started     { item: { id, type, ... } }
//   item.completed   { item: { id, type, ... } }   // type = agent_message | command_execution | apply_patch | ...
//   turn.completed   { usage: { input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens } }
//   error            { message }                   // terminal error
const KNOWN_TYPES = new Set([
  'thread.started',
  'turn.started',
  'item.started',
  'item.completed',
  'turn.completed',
  'error',
]);

type UsagePayload = {
  readonly input_tokens?: number;
  readonly cached_input_tokens?: number;
  readonly output_tokens?: number;
  readonly reasoning_output_tokens?: number;
};

type CommandItem = {
  readonly id: string;
  readonly type: 'command_execution';
  readonly command?: string;
  readonly aggregated_output?: string;
  readonly exit_code?: number | null;
  readonly status?: string;
};

type AgentMessageItem = {
  readonly id: string;
  readonly type: 'agent_message';
  readonly text?: string;
};

type ApplyPatchItem = {
  readonly id: string;
  readonly type: 'apply_patch' | 'file_change';
  readonly changes?: ReadonlyArray<{
    readonly path?: string;
    readonly kind?: 'create' | 'modify' | 'delete' | string;
  }>;
};

type CodexItem =
  | CommandItem
  | AgentMessageItem
  | ApplyPatchItem
  | { readonly id: string; readonly type: string; readonly [k: string]: unknown };

function isCommandItem(item: CodexItem): item is CommandItem {
  return item.type === 'command_execution';
}
function isAgentMessageItem(item: CodexItem): item is AgentMessageItem {
  return item.type === 'agent_message';
}
function isApplyPatchItem(item: CodexItem): item is ApplyPatchItem {
  return item.type === 'apply_patch' || item.type === 'file_change';
}

function commandToTurnEvents(
  item: CommandItem,
  phase: 'start' | 'end',
  ctx: ParseContext,
  at: IsoDateTime,
): ReadonlyArray<TurnEvent> {
  if (!item.id) return [];
  if (phase === 'start') {
    return [
      {
        kind: 'tool_call_start',
        runId: ctx.runId,
        toolUseId: item.id,
        toolName: 'shell',
        input: { command: item.command ?? '' },
        at,
      },
    ];
  }
  return [
    {
      kind: 'tool_call_end',
      runId: ctx.runId,
      toolUseId: item.id,
      output: {
        aggregated_output: item.aggregated_output ?? '',
        exit_code: item.exit_code ?? null,
      },
      isError: typeof item.exit_code === 'number' && item.exit_code !== 0,
      at,
    },
  ];
}

function applyPatchToTurnEvents(
  item: ApplyPatchItem,
  ctx: ParseContext,
  at: IsoDateTime,
): ReadonlyArray<TurnEvent> {
  if (!item.id) return [];
  const events: TurnEvent[] = [
    {
      kind: 'tool_call_end',
      runId: ctx.runId,
      toolUseId: item.id,
      output: item.changes ?? null,
      isError: false,
      at,
    },
  ];
  for (const change of item.changes ?? []) {
    if (typeof change.path !== 'string') continue;
    const editType: 'create' | 'modify' | 'delete' =
      change.kind === 'create' || change.kind === 'delete' ? change.kind : 'modify';
    events.push({
      kind: 'file_edit',
      runId: ctx.runId,
      path: change.path,
      editType,
      at,
    });
  }
  return events;
}

function buildUsage(raw: UsagePayload | undefined): ProviderUsage {
  const inputTokens = raw?.input_tokens ?? 0;
  const cachedInputTokens = raw?.cached_input_tokens ?? 0;
  const outputTokens = (raw?.output_tokens ?? 0) + (raw?.reasoning_output_tokens ?? 0);
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    estimatedCostUsd: 0,
  };
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
    case 'thread.started': {
      const threadId = payload['thread_id'];
      if (typeof threadId !== 'string' || threadId.length === 0) return [];
      return [
        {
          kind: 'provider_session_init',
          runId: ctx.runId,
          providerSessionId: threadId,
          at,
        },
      ];
    }

    case 'turn.started':
      return [];

    case 'item.started': {
      const item = payload['item'] as CodexItem | undefined;
      if (!item || typeof item.id !== 'string') return [];
      if (isCommandItem(item)) return commandToTurnEvents(item, 'start', ctx, at);
      return [];
    }

    case 'item.completed': {
      const item = payload['item'] as CodexItem | undefined;
      if (!item || typeof item.id !== 'string') return [];
      if (isCommandItem(item)) return commandToTurnEvents(item, 'end', ctx, at);
      if (isAgentMessageItem(item) && typeof item.text === 'string' && item.text.length > 0) {
        return [{ kind: 'assistant_text', runId: ctx.runId, delta: item.text, at }];
      }
      if (isApplyPatchItem(item)) return applyPatchToTurnEvents(item, ctx, at);
      return [];
    }

    case 'turn.completed': {
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
        devWarn(`[codex-adapter] unknown json payload type: ${type}`);
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
