import type { ProviderId } from '@goodboy/types';

export type AuxUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly estimatedCostUsd?: number;
};

export type AuxOutput = {
  readonly text: string;
  readonly usage: AuxUsage;
  readonly isError: boolean;
  readonly errorMessage: string | null;
  readonly envelopeDecoded: boolean;
};

type Params = {
  readonly providerId: ProviderId;
  readonly stdout: string;
};

const ZERO_USAGE: AuxUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asCount = (value: unknown): number => (typeof value === 'number' ? value : 0);

type PlainTextParams = {
  readonly text: string;
  readonly envelopeDecoded: boolean;
};

const plainText = ({ text, envelopeDecoded }: PlainTextParams): AuxOutput => ({
  text,
  usage: ZERO_USAGE,
  isError: false,
  errorMessage: null,
  envelopeDecoded,
});

const readJsonLines = (raw: string): ReadonlyArray<Record<string, unknown>> => {
  const out: Record<string, unknown>[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') === false) {
      continue;
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const record = asRecord(parsed);
    if (record !== null) {
      out.push(record);
    }
  }
  return out;
};

const readEnvelopeUsage = (value: unknown): AuxUsage => {
  const usage = asRecord(value);
  if (usage === null) {
    return ZERO_USAGE;
  }
  return {
    inputTokens: asCount(usage['input_tokens'] ?? usage['inputTokens']),
    outputTokens: asCount(usage['output_tokens'] ?? usage['outputTokens']),
    cachedInputTokens: asCount(usage['cache_read_input_tokens'] ?? usage['cacheReadTokens']),
    cacheCreationInputTokens: asCount(
      usage['cache_creation_input_tokens'] ?? usage['cacheCreationInputTokens'],
    ),
  };
};

const readCodexUsage = (value: unknown): AuxUsage => {
  const usage = asRecord(value);
  if (usage === null) {
    return ZERO_USAGE;
  }
  return {
    inputTokens: asCount(usage['input_tokens']),
    outputTokens: asCount(usage['output_tokens']) + asCount(usage['reasoning_output_tokens']),
    cachedInputTokens: asCount(usage['cached_input_tokens']),
    cacheCreationInputTokens: 0,
  };
};

const isFailedEnvelope = (payload: Record<string, unknown>): boolean => {
  if (payload['is_error'] === true) {
    return true;
  }
  const subtype = asString(payload['subtype']);
  return subtype !== null && subtype !== 'success';
};

const failureMessage = (payload: Record<string, unknown>): string =>
  asString(payload['error']) ?? asString(payload['subtype']) ?? 'provider reported an error';

const extractAnthropicEnvelope = (trimmed: string): AuxOutput => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return plainText({ text: trimmed, envelopeDecoded: false });
  }
  const payload = asRecord(parsed);
  if (payload === null) {
    return plainText({ text: trimmed, envelopeDecoded: false });
  }
  const isError = isFailedEnvelope(payload);
  const text = asString(payload['result']);
  return {
    text: text ?? '',
    usage: readEnvelopeUsage(payload['usage']),
    isError,
    errorMessage: isError ? failureMessage(payload) : null,
    envelopeDecoded: text !== null,
  };
};

const CURSOR_EVENT_TYPES: ReadonlySet<string> = new Set(['system', 'assistant', 'user', 'result']);

const CODEX_EVENT_TYPES: ReadonlySet<string> = new Set([
  'thread.started',
  'turn.started',
  'item.started',
  'item.completed',
  'turn.completed',
  'error',
]);

const OPENCODE_EVENT_TYPES: ReadonlySet<string> = new Set([
  'step_start',
  'text',
  'tool',
  'step_finish',
  'error',
]);

const hasEventOfType = (
  lines: ReadonlyArray<Record<string, unknown>>,
  known: ReadonlySet<string>,
): boolean =>
  lines.some((payload) => {
    const type = asString(payload['type']);
    return type !== null && known.has(type);
  });

const extractCursorStream = (lines: ReadonlyArray<Record<string, unknown>>): AuxOutput => {
  const chunks: string[] = [];
  let resultText: string | null = null;
  let usage = ZERO_USAGE;
  let isError = false;
  let errorMessage: string | null = null;

  for (const payload of lines) {
    if (payload['type'] === 'assistant') {
      const message = asRecord(payload['message']);
      const content = message === null ? null : message['content'];
      if (Array.isArray(content)) {
        for (const block of content) {
          const record = asRecord(block);
          const text = record === null ? null : asString(record['text']);
          if (record?.['type'] === 'text' && text !== null) {
            chunks.push(text);
          }
        }
      }
    }
    if (payload['type'] === 'result') {
      resultText = asString(payload['result']) ?? resultText;
      usage = readEnvelopeUsage(payload['usage']);
      if (isFailedEnvelope(payload)) {
        isError = true;
        errorMessage = failureMessage(payload);
      }
    }
  }

  const text = (resultText ?? chunks.join('')).trim();
  return {
    text,
    usage,
    isError,
    errorMessage,
    envelopeDecoded: text.length > 0 || isError,
  };
};

const extractCodexStream = (lines: ReadonlyArray<Record<string, unknown>>): AuxOutput => {
  let message: string | null = null;
  let usage = ZERO_USAGE;
  let isError = false;
  let errorMessage: string | null = null;

  for (const payload of lines) {
    if (payload['type'] === 'item.completed') {
      const item = asRecord(payload['item']);
      const text = item === null ? null : asString(item['text']);
      if (item?.['type'] === 'agent_message' && text !== null) {
        message = text;
      }
    }
    if (payload['type'] === 'turn.completed') {
      usage = readCodexUsage(payload['usage']);
    }
    if (payload['type'] === 'error') {
      isError = true;
      errorMessage = asString(payload['message']) ?? 'codex reported an error';
    }
  }

  const text = (message ?? '').trim();
  return {
    text,
    usage,
    isError,
    errorMessage,
    envelopeDecoded: text.length > 0 || isError,
  };
};

const readOpenCodeUsage = (value: unknown): AuxUsage => {
  const part = asRecord(value);
  const tokens = asRecord(part?.['tokens']);
  const cache = asRecord(tokens?.['cache']);
  const estimatedCostUsd = asCount(part?.['cost']);
  return {
    inputTokens: asCount(tokens?.['input']),
    outputTokens: asCount(tokens?.['output']) + asCount(tokens?.['reasoning']),
    cachedInputTokens: asCount(cache?.['read']),
    cacheCreationInputTokens: asCount(cache?.['write']),
    ...(estimatedCostUsd > 0 && { estimatedCostUsd }),
  };
};

const readOpenCodeError = (value: unknown): string => {
  const error = asRecord(value);
  const data = asRecord(error?.['data']);
  return (
    asString(data?.['message']) ?? asString(error?.['message']) ?? 'opencode reported an error'
  );
};

const extractOpenCodeStream = (lines: ReadonlyArray<Record<string, unknown>>): AuxOutput => {
  const textByPart = new Map<string, string>();
  let usage = ZERO_USAGE;
  let isError = false;
  let errorMessage: string | null = null;
  for (const payload of lines) {
    if (payload['type'] === 'text') {
      const part = asRecord(payload['part']);
      const id = asString(part?.['id']);
      const text = asString(part?.['text']);
      if (id !== null && text !== null) {
        textByPart.set(id, text);
      }
    }
    if (payload['type'] === 'step_finish') {
      usage = readOpenCodeUsage(payload['part']);
    }
    if (payload['type'] === 'error') {
      isError = true;
      errorMessage = readOpenCodeError(payload['error']);
    }
  }
  const text = [...textByPart.values()].join('').trim();
  return {
    text,
    usage,
    isError,
    errorMessage,
    envelopeDecoded: text.length > 0 || isError,
  };
};

export const extractAuxOutput = ({ providerId, stdout }: Params): AuxOutput => {
  const trimmed = stdout.trim();
  switch (providerId) {
    case 'anthropic':
      return extractAnthropicEnvelope(trimmed);
    case 'gemini':
      return plainText({ text: trimmed, envelopeDecoded: true });
    case 'cursor': {
      const lines = readJsonLines(trimmed);
      if (!hasEventOfType(lines, CURSOR_EVENT_TYPES)) {
        return plainText({ text: trimmed, envelopeDecoded: true });
      }
      return extractCursorStream(lines);
    }
    case 'codex': {
      const lines = readJsonLines(trimmed);
      if (!hasEventOfType(lines, CODEX_EVENT_TYPES)) {
        return plainText({ text: trimmed, envelopeDecoded: true });
      }
      return extractCodexStream(lines);
    }
    case 'opencode':
    case 'openrouter':
    case 'moonshot': {
      const lines = readJsonLines(trimmed);
      if (!hasEventOfType(lines, OPENCODE_EVENT_TYPES)) {
        return plainText({ text: trimmed, envelopeDecoded: true });
      }
      return extractOpenCodeStream(lines);
    }
    default: {
      const exhaustive: never = providerId;
      return plainText({ text: String(exhaustive), envelopeDecoded: false });
    }
  }
};
