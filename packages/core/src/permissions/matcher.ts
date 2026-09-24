import type { PermissionRulePattern } from '@goodboy/types';

type MatchParams = {
  readonly toolName: string;
  readonly input: unknown;
};

export type ToolMatcher = {
  readonly matches: (params: MatchParams) => boolean;
};

const REGEX_METACHARS = /[.+?()[\]{}\^$|\\]/g;

type GlobParams = {
  readonly glob: string;
};

const globToRegex = ({ glob }: GlobParams): RegExp => {
  let pattern = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i] ?? '';
    if (ch === '*' && glob[i + 1] === '*') {
      pattern += '.*';
      i += 2;
      continue;
    }
    if (ch === '*') {
      pattern += '[^:/]*';
      i += 1;
      continue;
    }
    pattern += ch.replace(REGEX_METACHARS, '\\$&');
    i += 1;
  }
  return new RegExp(`^${pattern}$`);
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

type ArgsMatcherParams = {
  readonly matcher: string;
};

export const parseArgsMatcher = ({ matcher }: ArgsMatcherParams): ((input: unknown) => boolean) => {
  if (matcher === '') {
    return () => true;
  }
  const re = globToRegex({ glob: matcher });
  return (input: unknown) => re.test(stringifyInput({ toolName: '', input }));
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
  const argsRe = globToRegex({ glob: pattern.slice(parenIdx + 1, pattern.lastIndexOf(')')) });
  return {
    matches: ({ toolName, input }) =>
      toolName === tool && argsRe.test(stringifyInput({ toolName, input })),
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
