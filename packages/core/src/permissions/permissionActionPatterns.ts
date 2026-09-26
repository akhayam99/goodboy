import type { PermissionRulePattern } from '@goodboy/types';

const FILE_PATH_TOOLS: ReadonlySet<string> = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
]);

const RUNNER_COMMANDS: ReadonlySet<string> = new Set([
  'pnpm',
  'npm',
  'yarn',
  'npx',
  'bun',
  'deno',
  'cargo',
  'go',
  'git',
  'make',
  'docker',
  'python',
  'python3',
]);

const CHAIN_OPERATORS: ReadonlyArray<string> = ['&&', '||', ';', '|'];

type StringFieldParams = {
  readonly input: unknown;
  readonly key: string;
};

const stringField = ({ input, key }: StringFieldParams): string | null => {
  if (input === null || typeof input !== 'object') {
    return null;
  }
  if (!(key in input)) {
    return null;
  }
  const value: unknown = Reflect.get(input, key);
  return typeof value === 'string' ? value : null;
};

export type ActionTarget = {
  readonly toolName: string;
  readonly input: unknown;
};

type InputOnly = {
  readonly input: unknown;
};

const commandOf = ({ input }: InputOnly): string => stringField({ input, key: 'command' }) ?? '';

const filePathOf = ({ input }: InputOnly): string => stringField({ input, key: 'file_path' }) ?? '';

type FirstSegmentParams = {
  readonly command: string;
};

const firstSegment = ({ command }: FirstSegmentParams): string => {
  let cut = command.trim();
  for (const operator of CHAIN_OPERATORS) {
    const idx = cut.indexOf(operator);
    if (idx !== -1) {
      cut = cut.slice(0, idx);
    }
  }
  return cut.trim();
};

export const commandPrefix = ({ command }: FirstSegmentParams): string => {
  const segment = firstSegment({ command });
  const tokens = segment.split(/\s+/).filter((token) => token.length > 0);
  const [first, second] = tokens;
  if (first === undefined) {
    return segment;
  }
  if (RUNNER_COMMANDS.has(first) && second !== undefined && !second.startsWith('-')) {
    return `${first} ${second}`;
  }
  return first;
};

export const oncePatternText = ({ toolName, input }: ActionTarget): string => {
  if (toolName === 'Bash') {
    const command = commandOf({ input });
    return command === '' ? toolName : `${toolName}(${command})`;
  }
  if (FILE_PATH_TOOLS.has(toolName)) {
    const path = filePathOf({ input });
    return path === '' ? toolName : `${toolName}(${path})`;
  }
  return toolName;
};

export type PrefixRule = {
  readonly pattern: PermissionRulePattern;
  readonly label: string;
};

export const prefixRuleFor = ({ toolName, input }: ActionTarget): PrefixRule => {
  if (toolName === 'Bash') {
    const command = commandOf({ input });
    const prefix = commandPrefix({ command });
    return {
      pattern: { tool: 'Bash', argsMatcher: `${prefix} *` },
      label: `Always allow "${prefix}"`,
    };
  }
  return { pattern: { tool: toolName }, label: 'Always allow edits' };
};

export const isFilePathTool = ({ toolName }: { readonly toolName: string }): boolean =>
  FILE_PATH_TOOLS.has(toolName);
