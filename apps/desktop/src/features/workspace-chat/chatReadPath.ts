import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly event: TurnEvent;
  readonly workingDir: string;
};

const PATH_KEYS = ['file_path', 'filePath', 'path'] as const;

const SHELL_WRAPPER = /^(?:\S*\/)?(?:ba|z)?sh\s+-l?c\s+([\s\S]+)$/;

const TOKEN = /'([^']*)'|"([^"]*)"|(\S+)/g;

const OPERATORS: ReadonlySet<string> = new Set(['&&', '||', '|', ';']);

const WHOLE_FILE_COMMANDS: ReadonlySet<string> = new Set(['cat', 'nl', 'head', 'tail']);

const SEARCH_COMMANDS: ReadonlySet<string> = new Set(['rg', 'grep']);

const COUNT_FLAGS: ReadonlySet<string> = new Set(['-n', '-c', '--lines', '--bytes']);

const SEARCH_VALUE_FLAGS: ReadonlySet<string> = new Set([
  '-e',
  '-f',
  '-g',
  '-t',
  '-T',
  '-A',
  '-B',
  '-C',
  '-m',
  '--glob',
  '--type',
  '--type-not',
  '--max-count',
  '--context',
  '--after-context',
  '--before-context',
  '--regexp',
]);

type InputParams = {
  readonly input: unknown;
};

type Token = {
  readonly text: string;
  readonly isQuoted: boolean;
};

type TextParams = {
  readonly text: string;
};

type ArgsParams = {
  readonly args: ReadonlyArray<string>;
};

type RelativeParams = {
  readonly path: string;
  readonly workingDir: string;
};

const pathOf = ({ input }: InputParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  for (const key of PATH_KEYS) {
    const value: unknown = Reflect.get(input, key);
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return null;
};

const commandOf = ({ input }: InputParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, 'command');
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  if (Array.isArray(value) && value.every((part) => typeof part === 'string')) {
    return value.join(' ');
  }
  return null;
};

const unquote = ({ text }: TextParams): string => {
  const first = text.at(0);
  const isWrapped = text.length >= 2 && (first === "'" || first === '"') && text.at(-1) === first;
  return isWrapped ? text.slice(1, -1) : text;
};

const unwrapShell = ({ text }: TextParams): string => {
  const match = SHELL_WRAPPER.exec(text);
  return match === null ? text : unquote({ text: (match[1] ?? '').trim() });
};

const tokenize = ({ text }: TextParams): ReadonlyArray<Token> =>
  [...text.matchAll(TOKEN)].map((match) => ({
    text: match[1] ?? match[2] ?? match[3] ?? '',
    isQuoted: match[3] === undefined,
  }));

const segmentsOf = ({ text }: TextParams): ReadonlyArray<ReadonlyArray<string>> => {
  const segments: string[][] = [];
  let current: string[] = [];
  for (const token of tokenize({ text })) {
    if (!token.isQuoted && OPERATORS.has(token.text)) {
      segments.push(current);
      current = [];
      continue;
    }
    current.push(token.text);
  }
  segments.push(current);
  return segments.filter((segment) => segment.length > 0);
};

const isFlag = ({ text }: TextParams): boolean => text.startsWith('-') && text !== '-';

const looksLikeFile = ({ text }: TextParams): boolean => {
  const name = text.split('/').at(-1) ?? '';
  return /^[^.].*\.[^./]+$/.test(name);
};

const wholeFileArgs = ({ args }: ArgsParams): ReadonlyArray<string> => {
  const paths: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (COUNT_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (!isFlag({ text: arg }) && !/^\d+$/.test(arg)) {
      paths.push(arg);
    }
  }
  return paths;
};

const sedArgs = ({ args }: ArgsParams): ReadonlyArray<string> => {
  if (!args.includes('-n')) {
    return [];
  }
  const operands: string[] = [];
  let hasScript = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '-e') {
      hasScript = true;
      index += 1;
      continue;
    }
    if (isFlag({ text: arg })) {
      continue;
    }
    operands.push(arg);
  }
  return hasScript ? operands : operands.slice(1);
};

const searchArgs = ({ args }: ArgsParams): ReadonlyArray<string> => {
  const operands: string[] = [];
  let hasPattern = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '-e' || arg === '--regexp') {
      hasPattern = true;
    }
    if (SEARCH_VALUE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (isFlag({ text: arg })) {
      continue;
    }
    operands.push(arg);
  }
  const paths = hasPattern ? operands : operands.slice(1);
  return paths.filter((path) => looksLikeFile({ text: path }));
};

const listArgs = ({ args }: ArgsParams): ReadonlyArray<string> =>
  args.filter((arg) => !isFlag({ text: arg }) && looksLikeFile({ text: arg }));

const readsOfSegment = ({ args: segment }: ArgsParams): ReadonlyArray<string> => {
  const [program = '', ...args] = segment;
  const name = program.split('/').at(-1) ?? '';
  if (WHOLE_FILE_COMMANDS.has(name)) {
    return wholeFileArgs({ args });
  }
  if (name === 'sed') {
    return sedArgs({ args });
  }
  if (SEARCH_COMMANDS.has(name)) {
    return searchArgs({ args });
  }
  if (name === 'ls') {
    return listArgs({ args });
  }
  return [];
};

const relativeTo = ({ path, workingDir }: RelativeParams): string => {
  const folder = workingDir.replace(/\/+$/, '');
  const inside = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
  return inside.replace(/^\.\//, '');
};

const shellReads = ({ text }: TextParams): ReadonlyArray<string> =>
  segmentsOf({ text: unwrapShell({ text }) })
    .flatMap((segment) => readsOfSegment({ args: segment }))
    .filter((path) => path !== '' && !/[<>|&$*?]/.test(path));

export const chatReadPaths = ({ event, workingDir }: Params): ReadonlyArray<string> => {
  if (event.kind !== 'tool_call_start') {
    return [];
  }
  if (/read/i.test(event.toolName)) {
    const path = pathOf({ input: event.input });
    return path === null ? [] : [relativeTo({ path, workingDir })];
  }
  if (event.toolName !== 'shell') {
    return [];
  }
  const command = commandOf({ input: event.input });
  if (command === null) {
    return [];
  }
  const paths = shellReads({ text: command }).map((path) => relativeTo({ path, workingDir }));
  return [...new Set(paths)];
};
