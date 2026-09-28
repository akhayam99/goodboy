import {
  parseCodexJsonLine,
  parseCursorStreamLine,
  parseGeminiJsonLine,
  parseOpenCodeJsonLine,
  parseStreamJsonLine,
  type ParseContext,
} from '@goodboy/core';
import type { ProviderId, TurnEvent } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly line: string;
  readonly ctx: ParseContext;
};

export const parseProviderLine = ({ provider, line, ctx }: Params): ReadonlyArray<TurnEvent> => {
  switch (provider) {
    case 'anthropic':
      return parseStreamJsonLine(line, ctx);
    case 'cursor':
      return parseCursorStreamLine(line, ctx);
    case 'codex':
      return parseCodexJsonLine(line, ctx);
    case 'gemini':
      return parseGeminiJsonLine(line, ctx);
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return parseOpenCodeJsonLine({ line, ctx });
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
};
