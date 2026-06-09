import type { TurnEvent } from '@goodboy/types';
import { parseAnthropicEnvelopeLine, type ParseContext } from '../shared/anthropic-envelope-parser';

export type { ParseContext };

export const parseCursorStreamLine = (
  line: string,
  ctx: ParseContext,
): ReadonlyArray<TurnEvent> => {
  return parseAnthropicEnvelopeLine(line, ctx, { adapter: 'cursor', logTag: 'cursor-adapter' });
};
