import type { IsoDateTime, ProviderRunId, ProviderUsage, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';

export type ParseContext = {
  readonly runId: ProviderRunId;
  readonly now: () => IsoDateTime;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

type ParseParams = {
  readonly line: string;
  readonly ctx: ParseContext;
};

type ResetParams = {
  readonly runId: ProviderRunId;
};

type TokenCache = {
  readonly read?: number;
  readonly write?: number;
};

type Tokens = {
  readonly input?: number;
  readonly output?: number;
  readonly reasoning?: number;
  readonly cache?: TokenCache;
};

type ToolState = {
  readonly status?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: unknown;
};

type Part = {
  readonly id?: string;
  readonly callID?: string;
  readonly type?: string;
  readonly text?: string;
  readonly tool?: string;
  readonly state?: ToolState;
  readonly tokens?: Tokens;
  readonly cost?: number;
  readonly path?: string;
  readonly filename?: string;
};

type ErrorPayload = {
  readonly message?: string;
  readonly data?: {
    readonly message?: string;
  };
};

type Payload = {
  readonly type?: string;
  readonly sessionID?: string;
  readonly part?: Part;
  readonly error?: ErrorPayload;
  readonly [key: string]: unknown;
};

type RunState = {
  hasSession: boolean;
  readonly textByPart: Map<string, string>;
  readonly startedTools: Set<string>;
  readonly endedTools: Set<string>;
};

const RUN_STATE = new Map<ProviderRunId, RunState>();

const stateFor = ({ runId }: ResetParams): RunState => {
  const existing = RUN_STATE.get(runId);
  if (existing !== undefined) {
    return existing;
  }
  const created: RunState = {
    hasSession: false,
    textByPart: new Map(),
    startedTools: new Set(),
    endedTools: new Set(),
  };
  RUN_STATE.set(runId, created);
  return created;
};

export const resetOpenCodeParseState = ({ runId }: ResetParams): void => {
  RUN_STATE.delete(runId);
};

type UsageParams = {
  readonly tokens: Tokens | undefined;
  readonly cost: number | undefined;
};

const buildUsage = ({ tokens, cost }: UsageParams): ProviderUsage => {
  return {
    inputTokens: tokens?.input ?? 0,
    outputTokens: (tokens?.output ?? 0) + (tokens?.reasoning ?? 0),
    cachedInputTokens: tokens?.cache?.read ?? 0,
    cacheCreationInputTokens: tokens?.cache?.write ?? 0,
    estimatedCostUsd: cost ?? 0,
  };
};

type EventParams = {
  readonly part: Part;
  readonly ctx: ParseContext;
  readonly at: IsoDateTime;
};

type UnknownParams = {
  readonly payload: Payload;
  readonly ctx: ParseContext;
  readonly at: IsoDateTime;
};

const textEvents = ({ part, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const partId = part.id ?? 'text';
  const fullText = part.text ?? '';
  const state = stateFor({ runId: ctx.runId });
  const previousText = state.textByPart.get(partId) ?? '';
  state.textByPart.set(partId, fullText);
  if (fullText.startsWith(previousText) === false || fullText.length <= previousText.length) {
    return [];
  }
  return [
    {
      kind: 'assistant_text',
      runId: ctx.runId,
      delta: fullText.slice(previousText.length),
      at,
    },
  ];
};

const toolEvents = ({ part, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const toolUseId = part.callID ?? part.id;
  if (toolUseId === undefined || toolUseId.length === 0) {
    return [];
  }
  const state = stateFor({ runId: ctx.runId });
  const events: TurnEvent[] = [];
  if (state.startedTools.has(toolUseId) === false) {
    state.startedTools.add(toolUseId);
    events.push({
      kind: 'tool_call_start',
      runId: ctx.runId,
      toolUseId,
      toolName: part.tool ?? 'tool',
      input: part.state?.input ?? {},
      at,
    });
  }
  const status = part.state?.status;
  const hasEnded = status === 'completed' || status === 'error';
  if (hasEnded === false || state.endedTools.has(toolUseId)) {
    return events;
  }
  state.endedTools.add(toolUseId);
  events.push({
    kind: 'tool_call_end',
    runId: ctx.runId,
    toolUseId,
    output: part.state?.output ?? part.state?.error ?? null,
    isError: status === 'error',
    at,
  });
  return events;
};

const partEvents = ({ part, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  switch (part.type) {
    case 'text':
      return textEvents({ part, ctx, at });
    case 'tool':
      return toolEvents({ part, ctx, at });
    case 'step-finish':
      return [
        {
          kind: 'usage',
          runId: ctx.runId,
          usage: buildUsage({ tokens: part.tokens, cost: part.cost }),
          at,
        },
      ];
    case 'file': {
      const path = part.path ?? part.filename;
      if (path === undefined || path.length === 0) {
        return [];
      }
      return [{ kind: 'file_edit', runId: ctx.runId, path, editType: 'modify', at }];
    }
    case 'reasoning':
    case 'step-start':
    case 'snapshot':
    case 'agent':
      return [];
    default:
      return [];
  }
};

const unknownEvent = ({ payload, ctx, at }: UnknownParams): ReadonlyArray<TurnEvent> => {
  const payloadType = payload.type;
  if (payloadType === undefined) {
    return [];
  }
  devWarn(`[opencode-adapter] unknown json payload type: ${payloadType}`);
  ctx.onUnknown?.(payloadType, payload);
  return [
    {
      kind: 'unknown_payload',
      runId: ctx.runId,
      adapter: 'opencode',
      payloadType,
      raw: payload,
      at,
    },
  ];
};

export const parseJsonLine = ({ line, ctx }: ParseParams): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }
  let payload: Payload;
  try {
    payload = JSON.parse(trimmed) as Payload;
  } catch {
    return [];
  }
  const at = ctx.now();
  const events: TurnEvent[] = [];
  const state = stateFor({ runId: ctx.runId });
  if (
    state.hasSession === false &&
    payload.sessionID !== undefined &&
    payload.sessionID.length > 0
  ) {
    state.hasSession = true;
    events.push({
      kind: 'provider_session_init',
      runId: ctx.runId,
      providerSessionId: payload.sessionID,
      at,
    });
  }
  if (payload.error !== undefined || payload.type === 'error') {
    const message =
      payload.error?.data?.message ??
      payload.error?.message ??
      JSON.stringify(payload.error ?? payload);
    events.push({ kind: 'error', runId: ctx.runId, message, at });
    resetOpenCodeParseState({ runId: ctx.runId });
    return events;
  }
  if (payload.part !== undefined) {
    events.push(...partEvents({ part: payload.part, ctx, at }));
    if (
      events.length > 0 ||
      payload.type === 'step_start' ||
      payload.type === 'step_finish' ||
      payload.type === 'text' ||
      payload.type === 'tool'
    ) {
      return events;
    }
  }
  events.push(...unknownEvent({ payload, ctx, at }));
  return events;
};
