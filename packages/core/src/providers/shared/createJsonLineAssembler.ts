import { escapeControlCharsInStrings } from './escapeControlCharsInStrings';
import { parseJsonAllowingControlChars } from './parseJsonAllowingControlChars';

export const JSON_LINE_ASSEMBLER_MAX_HELD_LINES = 64;
export const JSON_LINE_ASSEMBLER_MAX_HELD_BYTES = 256 * 1024;

export type JsonLineAssemblerResult =
  | { readonly kind: 'line'; readonly line: string }
  | { readonly kind: 'pending' }
  | { readonly kind: 'overflow'; readonly lines: ReadonlyArray<string> };

type PushParams = {
  readonly line: string;
};

export type JsonLineAssembler = {
  readonly push: (params: PushParams) => JsonLineAssemblerResult;
  readonly flush: () => ReadonlyArray<string>;
};

const opensJsonObject = ({ line }: PushParams): boolean => line.trimStart().startsWith('{');

const parses = ({ line }: PushParams): boolean =>
  parseJsonAllowingControlChars({ text: line.trim() }).ok;

export const createJsonLineAssembler = (): JsonLineAssembler => {
  let held: string[] = [];
  let heldBytes = 0;

  const release = (): ReadonlyArray<string> => {
    const lines = held;
    held = [];
    heldBytes = 0;
    return lines;
  };

  const hold = ({ line }: PushParams): JsonLineAssemblerResult => {
    held.push(line);
    heldBytes += line.length;
    if (held.length >= JSON_LINE_ASSEMBLER_MAX_HELD_LINES) {
      return { kind: 'overflow', lines: release() };
    }
    if (heldBytes >= JSON_LINE_ASSEMBLER_MAX_HELD_BYTES) {
      return { kind: 'overflow', lines: release() };
    }
    return { kind: 'pending' };
  };

  const push = ({ line }: PushParams): JsonLineAssemblerResult => {
    if (held.length === 0) {
      if (!opensJsonObject({ line }) || parses({ line })) {
        return { kind: 'line', line };
      }
      return hold({ line });
    }
    const joined = [...held, line].join('\n');
    if (parses({ line: joined })) {
      release();
      return { kind: 'line', line: escapeControlCharsInStrings({ value: joined.trim() }) };
    }
    if (opensJsonObject({ line }) && parses({ line })) {
      return { kind: 'overflow', lines: [...release(), line] };
    }
    return hold({ line });
  };

  return { push, flush: release };
};
