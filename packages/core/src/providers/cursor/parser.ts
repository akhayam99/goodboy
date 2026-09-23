import type { ProviderUsage, TurnEvent } from '@goodboy/types';
import { parseAnthropicEnvelopeLine, type ParseContext } from '../shared/anthropic-envelope-parser';

export type { ParseContext };

const MULTI_REQUEST_TURNS = new WeakSet<ParseContext>();

type LineTypeParams = {
  readonly line: string;
};

const lineType = ({ line }: LineTypeParams): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const type = (parsed as { type?: unknown }).type;
    return typeof type === 'string' ? type : undefined;
  } catch {
    return undefined;
  }
};

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
  const type =
    line.includes('"tool_call"') || line.includes('"result"') ? lineType({ line }) : undefined;
  if (type === 'tool_call') {
    MULTI_REQUEST_TURNS.add(ctx);
  }
  const events = parseAnthropicEnvelopeLine(line, ctx, {
    adapter: 'cursor',
    logTag: 'cursor-adapter',
  });
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
