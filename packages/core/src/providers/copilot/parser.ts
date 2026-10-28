import type { IsoDateTime, ProviderRunId, ProviderUsage, TurnEvent } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { devWarn } from '../../dev-log';
import { parseJsonAllowingControlChars } from '../shared/parseJsonAllowingControlChars';
import {
  blockBoundaryPrefix,
  continueBoundaryText,
  resetTextBoundary,
} from '../shared/text-boundary';

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

type Data = Readonly<Record<string, unknown>>;

type Checkpoint = {
  readonly premiumRequests: number | undefined;
  readonly nanoAiu: number | undefined;
  readonly snapshot: unknown;
};

type RunState = {
  readonly streamedMessages: Set<string>;
  readonly openMessages: Set<string>;
  checkpoint: Checkpoint | undefined;
};

const RUN_STATE = new Map<ProviderRunId, RunState>();

const runStateOf = ({ runId }: ResetParams): RunState => {
  const existing = RUN_STATE.get(runId);
  if (existing !== undefined) {
    return existing;
  }
  const created: RunState = {
    streamedMessages: new Set(),
    openMessages: new Set(),
    checkpoint: undefined,
  };
  RUN_STATE.set(runId, created);
  return created;
};

export const resetCopilotParseState = ({ runId }: ResetParams): void => {
  RUN_STATE.delete(runId);
  resetTextBoundary({ runId });
};

type PathParams = {
  readonly value: unknown;
  readonly path: ReadonlyArray<string>;
};

const valueAt = ({ value, path }: PathParams): unknown => {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

const stringAt = ({ value, path }: PathParams): string | undefined => {
  const found = valueAt({ value, path });
  return typeof found === 'string' ? found : undefined;
};

const finiteAt = ({ value, path }: PathParams): number | undefined => {
  const found = valueAt({ value, path });
  return typeof found === 'number' && Number.isFinite(found) ? found : undefined;
};

const IGNORED_TYPES: ReadonlySet<string> = new Set([
  'session.mcp_server_status_changed',
  'session.mcp_server_tools_loaded',
  'session.mcp_servers_loaded',
  'session.tools_updated',
  'session.info',
  'user.message',
  'assistant.turn_start',
  'assistant.turn_end',
  'assistant.message_start',
  'assistant.tool_call_delta',
  'assistant.idle',
  'model.call_start',
  'model.call_finished',
  'model.call_final_result',
]);

type EventParams = {
  readonly data: Data;
  readonly ctx: ParseContext;
  readonly at: IsoDateTime;
};

const deltaEvents = ({ data, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const text = stringAt({ value: data, path: ['deltaContent'] }) ?? '';
  if (text.length === 0) {
    return [];
  }
  const state = runStateOf({ runId: ctx.runId });
  const messageId = stringAt({ value: data, path: ['messageId'] }) ?? '';
  state.streamedMessages.add(messageId);
  const isOpen = state.openMessages.has(messageId);
  state.openMessages.add(messageId);
  if (isOpen) {
    continueBoundaryText({ runId: ctx.runId, text });
    return [{ kind: 'assistant_text', runId: ctx.runId, delta: text, at, isPartial: true }];
  }
  const prefix = blockBoundaryPrefix({ runId: ctx.runId, text });
  return [
    { kind: 'assistant_text', runId: ctx.runId, delta: `${prefix}${text}`, at, isPartial: true },
  ];
};

const messageEvents = ({ data, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const state = runStateOf({ runId: ctx.runId });
  const messageId = stringAt({ value: data, path: ['messageId'] }) ?? '';
  const wasStreamed = state.streamedMessages.has(messageId);
  state.openMessages.delete(messageId);
  const text = stringAt({ value: data, path: ['content'] }) ?? '';
  if (wasStreamed || text.length === 0) {
    return [];
  }
  const prefix = blockBoundaryPrefix({ runId: ctx.runId, text });
  return [{ kind: 'assistant_text', runId: ctx.runId, delta: `${prefix}${text}`, at }];
};

const toolStartEvents = ({ data, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const toolUseId = stringAt({ value: data, path: ['toolCallId'] });
  if (toolUseId === undefined || toolUseId.length === 0) {
    return [];
  }
  return [
    {
      kind: 'tool_call_start',
      runId: ctx.runId,
      toolUseId,
      toolName: stringAt({ value: data, path: ['toolName'] }) ?? 'tool',
      input: data['arguments'] ?? {},
      at,
    },
  ];
};

type EditTypeParams = {
  readonly kind: string | undefined;
};

const editTypeOf = ({ kind }: EditTypeParams): 'create' | 'modify' | 'delete' => {
  if (kind === 'create') {
    return 'create';
  }
  if (kind === 'delete') {
    return 'delete';
  }
  return 'modify';
};

const fileEditEvents = ({ data, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const edits = data['fileEdits'];
  if (!Array.isArray(edits)) {
    return [];
  }
  const events: TurnEvent[] = [];
  for (const edit of edits) {
    const path = stringAt({ value: edit, path: ['path'] });
    if (path !== undefined && path.length > 0) {
      events.push({
        kind: 'file_edit',
        runId: ctx.runId,
        path,
        editType: editTypeOf({ kind: stringAt({ value: edit, path: ['kind'] }) }),
        at,
      });
    }
  }
  return events;
};

const toolEndEvents = ({ data, ctx, at }: EventParams): ReadonlyArray<TurnEvent> => {
  const toolUseId = stringAt({ value: data, path: ['toolCallId'] });
  if (toolUseId === undefined || toolUseId.length === 0) {
    return [];
  }
  return [
    ...fileEditEvents({ data, ctx, at }),
    {
      kind: 'tool_call_end',
      runId: ctx.runId,
      toolUseId,
      output:
        valueAt({ value: data, path: ['result', 'content'] }) ??
        valueAt({ value: data, path: ['result', 'detailedContent'] }) ??
        null,
      isError: data['success'] === false,
      at,
    },
  ];
};

type CheckpointParams = {
  readonly data: Data;
  readonly ctx: ParseContext;
};

const rememberCheckpoint = ({ data, ctx }: CheckpointParams): void => {
  runStateOf({ runId: ctx.runId }).checkpoint = {
    premiumRequests: finiteAt({ value: data, path: ['totalPremiumRequests'] }),
    nanoAiu: finiteAt({ value: data, path: ['totalNanoAiu'] }),
    snapshot: data['accountingSnapshot'],
  };
};

type SumParams = {
  readonly snapshot: unknown;
  readonly key: string;
};

const sumModels = ({ snapshot, key }: SumParams): number => {
  const metrics = valueAt({ value: snapshot, path: ['modelMetrics'] });
  if (!isRecord(metrics)) {
    return 0;
  }
  return Object.values(metrics).reduce<number>(
    (total, model) => total + (finiteAt({ value: model, path: ['usage', key] }) ?? 0),
    0,
  );
};

type DetailParams = {
  readonly snapshot: unknown;
  readonly key: string;
};

const tokenDetailOf = ({ snapshot, key }: DetailParams): number | undefined =>
  finiteAt({ value: snapshot, path: ['tokenDetails', key, 'tokenCount'] });

type UsageFromParams = {
  readonly checkpoint: Checkpoint;
  readonly premiumRequests: number | undefined;
};

const usageFrom = ({ checkpoint, premiumRequests }: UsageFromParams): ProviderUsage => {
  const { snapshot } = checkpoint;
  const cachedInputTokens =
    tokenDetailOf({ snapshot, key: 'cache_read' }) ??
    sumModels({ snapshot, key: 'cacheReadTokens' });
  const cacheCreationInputTokens =
    tokenDetailOf({ snapshot, key: 'cache_write' }) ??
    sumModels({ snapshot, key: 'cacheWriteTokens' });
  const inputTokens =
    tokenDetailOf({ snapshot, key: 'input' }) ??
    Math.max(
      0,
      sumModels({ snapshot, key: 'inputTokens' }) - cachedInputTokens - cacheCreationInputTokens,
    );
  const outputTokens =
    tokenDetailOf({ snapshot, key: 'output' }) ?? sumModels({ snapshot, key: 'outputTokens' });
  const lastInput = finiteAt({ value: snapshot, path: ['lastCallInputTokens'] });
  const lastOutput = finiteAt({ value: snapshot, path: ['lastCallOutputTokens'] }) ?? 0;
  const premium = premiumRequests ?? checkpoint.premiumRequests;
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheCreationInputTokens,
    ...(lastInput !== undefined && { contextTokens: lastInput + lastOutput }),
    ...(premium !== undefined && { premiumRequests: premium }),
    ...(checkpoint.nanoAiu !== undefined && { nanoAiu: checkpoint.nanoAiu }),
    estimatedCostUsd: 0,
  };
};

type ResultParams = {
  readonly payload: Data;
  readonly ctx: ParseContext;
  readonly at: IsoDateTime;
};

const resultEvents = ({ payload, ctx, at }: ResultParams): ReadonlyArray<TurnEvent> => {
  const state = runStateOf({ runId: ctx.runId });
  const events: TurnEvent[] = [];
  const sessionId = stringAt({ value: payload, path: ['sessionId'] });
  if (sessionId !== undefined && sessionId.length > 0) {
    events.push({
      kind: 'provider_session_init',
      runId: ctx.runId,
      providerSessionId: sessionId,
      at,
    });
  }
  if (state.checkpoint !== undefined) {
    events.push({
      kind: 'usage',
      runId: ctx.runId,
      usage: usageFrom({
        checkpoint: state.checkpoint,
        premiumRequests: finiteAt({ value: payload, path: ['usage', 'premiumRequests'] }),
      }),
      at,
    });
  }
  resetCopilotParseState({ runId: ctx.runId });
  return events;
};

type UnknownParams = {
  readonly payload: Data;
  readonly payloadType: string;
  readonly ctx: ParseContext;
  readonly at: IsoDateTime;
};

const unknownEvents = ({
  payload,
  payloadType,
  ctx,
  at,
}: UnknownParams): ReadonlyArray<TurnEvent> => {
  devWarn(`[copilot-adapter] unknown json payload type: ${payloadType}`);
  ctx.onUnknown?.(payloadType, payload);
  return [
    {
      kind: 'unknown_payload',
      runId: ctx.runId,
      adapter: 'copilot',
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
  const parsed = parseJsonAllowingControlChars({ text: trimmed });
  if (!parsed.ok || !isRecord(parsed.value)) {
    devWarn('[copilot-adapter] dropped a json line that does not parse');
    return [];
  }
  const payload = parsed.value;
  const type = stringAt({ value: payload, path: ['type'] });
  if (type === undefined || IGNORED_TYPES.has(type)) {
    return [];
  }
  const at = ctx.now();
  const dataValue = payload['data'];
  const data: Data = isRecord(dataValue) ? dataValue : {};
  switch (type) {
    case 'assistant.message_delta':
      return deltaEvents({ data, ctx, at });
    case 'assistant.message':
      return messageEvents({ data, ctx, at });
    case 'tool.execution_start':
      return toolStartEvents({ data, ctx, at });
    case 'tool.execution_complete':
      return toolEndEvents({ data, ctx, at });
    case 'session.usage_checkpoint':
      rememberCheckpoint({ data, ctx });
      return [];
    case 'result':
      return resultEvents({ payload, ctx, at });
    default:
      if (payload['ephemeral'] === true) {
        return [];
      }
      return unknownEvents({ payload, payloadType: type, ctx, at });
  }
};
