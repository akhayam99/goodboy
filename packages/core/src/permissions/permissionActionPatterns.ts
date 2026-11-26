import type { PermissionRulePattern } from '@goodboy/types';

const FILE_PATH_TOOLS: ReadonlySet<string> = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
]);

const READ_TOOLS: ReadonlySet<string> = new Set(['Read', 'Grep', 'Glob']);

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

export type ToolClass = 'shell' | 'edit' | 'read' | 'other';

type ToolNameParams = {
  readonly toolName: string;
};

export const toolClassOf = ({ toolName }: ToolNameParams): ToolClass => {
  if (toolName === 'Bash') {
    return 'shell';
  }
  if (FILE_PATH_TOOLS.has(toolName)) {
    return 'edit';
  }
  return READ_TOOLS.has(toolName) ? 'read' : 'other';
};

export const actionNounOf = ({ toolName }: ToolNameParams): string => {
  const toolClass = toolClassOf({ toolName });
  if (toolClass === 'shell') {
    return 'command';
  }
  return toolClass === 'other' ? 'call' : toolClass;
};

const pathFieldOf = ({ toolName, input }: ActionTarget): string =>
  toolName === 'Read' ? filePathOf({ input }) : (stringField({ input, key: 'path' }) ?? '');

type PathParams = {
  readonly path: string;
};

const trimmedSlashes = ({ path }: PathParams): string => {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') {
    end -= 1;
  }
  return path.slice(0, end);
};

const hasFileName = ({ path }: PathParams): boolean => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.lastIndexOf('.') > 0;
};

const parentFolderOf = ({ path }: PathParams): string => {
  const trimmed = trimmedSlashes({ path });
  return trimmed.slice(0, trimmed.lastIndexOf('/'));
};

const scopeText = ({ path }: PathParams): string => `//${path.slice(1)}`;

const readScopeOf = ({ toolName, input }: ActionTarget): string | null => {
  const path = pathFieldOf({ toolName, input });
  if (!path.startsWith('/')) {
    return null;
  }
  if (toolName === 'Read') {
    const parent = parentFolderOf({ path });
    return parent === '' ? null : `${scopeText({ path: parent })}/**`;
  }
  const trimmed = trimmedSlashes({ path });
  if (trimmed === '') {
    return null;
  }
  const isFile = !path.endsWith('/') && toolName === 'Grep' && hasFileName({ path: trimmed });
  return isFile ? scopeText({ path: trimmed }) : `${scopeText({ path: trimmed })}/**`;
};

export const oncePatternText = ({ toolName, input }: ActionTarget): string => {
  if (toolName === 'Read') {
    const path = filePathOf({ input });
    if (path === '') {
      return toolName;
    }
    return `${toolName}(${path.startsWith('/') ? `/${path}` : path})`;
  }
  if (toolName === 'Grep' || toolName === 'Glob') {
    const scope = readScopeOf({ toolName, input });
    return scope === null ? toolName : `Read(${scope})`;
  }
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
  readonly subject: string;
  readonly label: string;
  readonly sessionPattern: PermissionRulePattern;
  readonly sessionLabel: string;
};

type ScopeParams = {
  readonly scope: string;
};

const shortFolderOf = ({ scope }: ScopeParams): string =>
  (scope.endsWith('/**') ? scope.slice(2, -3) : scope.slice(2))
    .split('/')
    .filter((segment) => segment !== '')
    .slice(-2)
    .join('/');

export const prefixRuleFor = ({ toolName, input }: ActionTarget): PrefixRule => {
  const toolClass = toolClassOf({ toolName });
  if (toolClass === 'shell') {
    const command = commandOf({ input });
    const prefix = commandPrefix({ command });
    return {
      pattern: { tool: 'Bash', argsMatcher: `${prefix} *` },
      subject: `"${prefix}"`,
      label: `Always allow "${prefix}"`,
      sessionPattern: { tool: 'Bash' },
      sessionLabel: 'Allow all commands in this session',
    };
  }
  if (toolClass === 'read') {
    const scope = readScopeOf({ toolName, input });
    const pattern: PermissionRulePattern =
      scope === null ? { tool: toolName } : { tool: 'Read', argsMatcher: scope };
    const subject = scope === null ? 'reads' : `reads in ${shortFolderOf({ scope })}`;
    return {
      pattern,
      subject,
      label: `Always allow ${subject}`,
      sessionPattern: pattern,
      sessionLabel: `Allow ${subject} in this session`,
    };
  }
  if (toolClass === 'edit') {
    return {
      pattern: { tool: toolName },
      subject: 'edits',
      label: 'Always allow edits',
      sessionPattern: { tool: toolName },
      sessionLabel: 'Allow all edits in this session',
    };
  }
  return {
    pattern: { tool: toolName },
    subject: toolName,
    label: `Always allow ${toolName}`,
    sessionPattern: { tool: toolName },
    sessionLabel: `Allow ${toolName} in this session`,
  };
};

export const isFilePathTool = ({ toolName }: { readonly toolName: string }): boolean =>
  FILE_PATH_TOOLS.has(toolName);
