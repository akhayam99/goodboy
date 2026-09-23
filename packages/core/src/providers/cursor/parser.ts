import type { ProviderUsage, TurnEvent } from '@goodboy/types';
import { devWarn } from '../../dev-log';
import {
  parseAnthropicEnvelopeValue,
  type ParseContext,
} from '../shared/anthropic-envelope-parser';
import { parseJsonAllowingControlChars } from '../shared/parseJsonAllowingControlChars';

export type { ParseContext };

const MULTI_REQUEST_TURNS = new WeakSet<ParseContext>();

type PayloadTypeParams = {
  readonly value: unknown;
};

const payloadType = ({ value }: PayloadTypeParams): string | undefined => {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return undefined;
  }
  return typeof value.type === 'string' ? value.type : undefined;
};

const CURSOR_ENVELOPE = { adapter: 'cursor', logTag: 'cursor-adapter' } as const;

type SingleRequestParams = {
  readonly usage: ProviderUsage;
};

const singleRequestContext = ({ usage }: SingleRequestParams): ProviderUsage => {
  if (usage.contextTokens != null) {
    return usage;
  }
  return {
    ...usage,
    contextTokens:
      usage.inputTokens +
      usage.outputTokens +
      usage.cachedInputTokens +
      (usage.cacheCreationInputTokens ?? 0),
  };
};

export const parseCursorStreamLine = (
  line: string,
  ctx: ParseContext,
): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const parsed = parseJsonAllowingControlChars({ text: trimmed });
  if (!parsed.ok) {
    devWarn(`[${CURSOR_ENVELOPE.logTag}] dropped a stream-json line that is not json`);
    return [];
  }
  const type = payloadType({ value: parsed.value });
  if (type === 'tool_call') {
    MULTI_REQUEST_TURNS.add(ctx);
  }
  const events = parseAnthropicEnvelopeValue({ value: parsed.value, ctx, opts: CURSOR_ENVELOPE });
  if (type !== 'result') {
    return events;
  }
  const multiRequest = MULTI_REQUEST_TURNS.has(ctx);
  MULTI_REQUEST_TURNS.delete(ctx);
  if (multiRequest) {
    return events;
  }
  return events.map((event) =>
    event.kind === 'usage'
      ? { ...event, usage: singleRequestContext({ usage: event.usage }) }
      : event,
  );
};
