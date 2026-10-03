import type { TurnEvent, TurnState } from '@goodboy/types';

const QUIET_AFTER_MS = 15 * 60 * 1000;

export type QuietSignal = {
  readonly isLive: boolean;
  readonly lastAt: string | null;
  readonly isToolOpen: boolean;
  readonly lastLabel: string | null;
};

export const NOT_LIVE: QuietSignal = {
  isLive: false,
  lastAt: null,
  isToolOpen: false,
  lastLabel: null,
};

type SignalParams = {
  readonly turn: TurnState | undefined;
  readonly events: ReadonlyArray<TurnEvent> | undefined;
};

const DETAIL_KEYS = ['file_path', 'path', 'command', 'pattern', 'url'] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const toolDetail = ({ input }: { readonly input: unknown }): string | null => {
  if (!isRecord(input)) {
    return null;
  }
  for (const key of DETAIL_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim().split('\n')[0] ?? null;
    }
  }
  return null;
};

const toolLabel = ({
  toolName,
  input,
}: {
  readonly toolName: string;
  readonly input: unknown;
}): string => {
  const detail = toolDetail({ input });
  return detail === null ? toolName : `${toolName} ${detail}`;
};

const labelOf = ({
  event,
  toolNames,
}: {
  readonly event: TurnEvent;
  readonly toolNames: ReadonlyMap<string, string>;
}): string | null => {
  switch (event.kind) {
    case 'tool_call_start':
      return toolLabel({ toolName: event.toolName, input: event.input });
    case 'tool_call_end':
      return toolNames.get(event.toolUseId) ?? 'a tool call';
    case 'assistant_text':
      return 'a message';
    case 'file_edit':
      return `an edit to ${event.path}`;
    default:
      return null;
  }
};

export const quietSignalOf = ({ turn, events }: SignalParams): QuietSignal => {
  if (turn?.kind !== 'running') {
    return NOT_LIVE;
  }
  const list = events ?? [];
  const ended = new Set<string>();
  const decided = new Set<string>();
  const toolNames = new Map<string, string>();
  const runEvents: Array<TurnEvent> = [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const event = list[index];
    if (event === undefined || event.runId !== turn.runId) {
      break;
    }
    runEvents.push(event);
  }
  let isToolOpen = false;
  for (const event of runEvents) {
    if (event.kind === 'tool_call_end') {
      ended.add(event.toolUseId);
    }
    if (event.kind === 'permission_decision') {
      decided.add(event.toolUseId);
    }
    if (event.kind === 'tool_call_start') {
      toolNames.set(event.toolUseId, toolLabel({ toolName: event.toolName, input: event.input }));
      isToolOpen = isToolOpen || !ended.has(event.toolUseId);
    }
    if (event.kind === 'permission_request') {
      isToolOpen = isToolOpen || !decided.has(event.toolUseId);
    }
  }
  const newest = runEvents[0];
  const lastAt = newest !== undefined && newest.at > turn.startedAt ? newest.at : turn.startedAt;
  const lastLabel =
    runEvents
      .map((event) => labelOf({ event, toolNames }))
      .find((label): label is string => label !== null) ?? null;
  return { isLive: true, lastAt, isToolOpen, lastLabel };
};

type QuietParams = {
  readonly signal: QuietSignal;
  readonly nowMs: number;
};

export const quietMsOf = ({ signal, nowMs }: QuietParams): number | null => {
  if (!signal.isLive || signal.isToolOpen || signal.lastAt === null) {
    return null;
  }
  const quietMs = nowMs - Date.parse(signal.lastAt);
  return quietMs >= QUIET_AFTER_MS ? quietMs : null;
};
