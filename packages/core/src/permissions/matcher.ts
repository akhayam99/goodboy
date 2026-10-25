import type { PermissionRulePattern } from '@goodboy/types';

type MatchParams = {
  readonly toolName: string;
  readonly input: unknown;
};

export type ToolMatcher = {
  readonly matches: (params: MatchParams) => boolean;
};

const SEGMENT_STOPS: ReadonlySet<string> = new Set([':', '/', ';', '&', '|', '`', '\n', '\r']);

type GlobToken =
  | { readonly kind: 'literal'; readonly ch: string }
  | { readonly kind: 'segment' }
  | { readonly kind: 'any' };

type GlobParams = {
  readonly glob: string;
};

const tokenizeGlob = ({ glob }: GlobParams): ReadonlyArray<GlobToken> => {
  const tokens: Array<GlobToken> = [];
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i] ?? '';
    if (ch === '*' && glob[i + 1] === '*') {
      tokens.push({ kind: 'any' });
      i += 2;
      continue;
    }
    if (ch === '*') {
      tokens.push({ kind: 'segment' });
      i += 1;
      continue;
    }
    tokens.push({ kind: 'literal', ch });
    i += 1;
  }
  return tokens;
};

type StepParams = {
  readonly reach: Uint8Array;
  readonly text: string;
};

type LiteralStepParams = StepParams & {
  readonly ch: string;
};

const stepLiteral = ({ reach, text, ch }: LiteralStepParams): Uint8Array => {
  const next = new Uint8Array(text.length + 1);
  for (let i = 0; i < text.length; i += 1) {
    if (reach[i] === 1 && text[i] === ch) {
      next[i + 1] = 1;
    }
  }
  return next;
};

type StarStepParams = StepParams & {
  readonly isDeep: boolean;
};

const stepStar = ({ reach, text, isDeep }: StarStepParams): Uint8Array => {
  const next = new Uint8Array(text.length + 1);
  next[0] = reach[0] ?? 0;
  for (let i = 1; i <= text.length; i += 1) {
    const canCross = isDeep || !SEGMENT_STOPS.has(text[i - 1] ?? '');
    next[i] = reach[i] === 1 || (next[i - 1] === 1 && canCross) ? 1 : 0;
  }
  return next;
};

type GlobTestParams = {
  readonly tokens: ReadonlyArray<GlobToken>;
  readonly text: string;
};

const globTest = ({ tokens, text }: GlobTestParams): boolean => {
  let reach: Uint8Array = new Uint8Array(text.length + 1);
  reach[0] = 1;
  for (const token of tokens) {
    reach =
      token.kind === 'literal'
        ? stepLiteral({ reach, text, ch: token.ch })
        : stepStar({ reach, text, isDeep: token.kind === 'any' });
  }
  return reach[text.length] === 1;
};

const FILE_PATH_TOOLS: ReadonlySet<string> = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
]);

type FieldParams = {
  readonly input: object;
  readonly key: string;
};

const stringField = ({ input, key }: FieldParams): string | null => {
  if (!(key in input)) {
    return null;
  }
  const value: unknown = Reflect.get(input, key);
  return typeof value === 'string' ? value : null;
};

const stringifyInput = ({ toolName, input }: MatchParams): string => {
  if (input === null || input === undefined) {
    return '';
  }
  if (typeof input !== 'object') {
    return JSON.stringify(input);
  }
  if (toolName === 'Bash') {
    return stringField({ input, key: 'command' }) ?? JSON.stringify(input);
  }
  if (FILE_PATH_TOOLS.has(toolName)) {
    return stringField({ input, key: 'file_path' }) ?? JSON.stringify(input);
  }
  return JSON.stringify(input);
};

type PatternTextParams = {
  readonly pattern: string;
};

export const parseToolPattern = ({ pattern }: PatternTextParams): ToolMatcher => {
  const parenIdx = pattern.indexOf('(');
  if (parenIdx === -1) {
    const tool = pattern.trim();
    if (tool === '*') {
      return { matches: () => true };
    }
    return { matches: ({ toolName }) => toolName === tool };
  }
  const tool = pattern.slice(0, parenIdx).trim();
  const tokens = tokenizeGlob({ glob: pattern.slice(parenIdx + 1, pattern.lastIndexOf(')')) });
  return {
    matches: ({ toolName, input }) =>
      toolName === tool && globTest({ tokens, text: stringifyInput({ toolName, input }) }),
  };
};

type RulePatternParams = {
  readonly pattern: PermissionRulePattern;
};

export const formatToolPattern = ({ pattern }: RulePatternParams): string => {
  if (pattern.argsMatcher == null || pattern.argsMatcher === '') {
    return pattern.tool;
  }
  return `${pattern.tool}(${pattern.argsMatcher})`;
};

const COMPILED_MATCHERS = new Map<string, ToolMatcher>();

export const compiledToolMatcher = ({ pattern }: RulePatternParams): ToolMatcher => {
  const formatted = formatToolPattern({ pattern });
  const cached = COMPILED_MATCHERS.get(formatted);
  if (cached !== undefined) {
    return cached;
  }
  const matcher = parseToolPattern({ pattern: formatted });
  COMPILED_MATCHERS.set(formatted, matcher);
  return matcher;
};
