type Params = {
  readonly text: string;
};

type StepsParams = Params & {
  readonly depth: number;
};

type UnwrapParams = {
  readonly tokens: ReadonlyArray<string>;
};

const SETUP_PROGRAMS: ReadonlySet<string> = new Set(['cd', 'export', 'source', 'set', 'unset']);
const SHELLS: ReadonlySet<string> = new Set(['sh', 'bash', 'zsh', 'fish', 'dash']);
const SCRIPT_RUNNERS: ReadonlySet<string> = new Set([
  'pnpm',
  'npm',
  'yarn',
  'bun',
  'npx',
  'cargo',
  'make',
  'just',
  'vitest',
  'jest',
  'turbo',
]);
const VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '--filter',
  '-F',
  '--dir',
  '-C',
  '--prefix',
  '--cwd',
  '--workspace',
  '--manifest-path',
  '--package',
  '-p',
]);
const MAX_SCRIPT_WORDS = 2;
const MAX_SHELL_DEPTH = 2;
const SHORT_FLAGS = /^-[a-z]+$/;
const TOKEN = /[ \t\r]*(&&|\|\||[;|&\n]|(?:"(?:\\.|[^"\\])*"|'[^']*'|\\.|[^\s;&|"'\\])+)/y;
const WORD_PART = /"((?:\\.|[^"\\])*)"|'([^']*)'|\\(.)|([^"'\\]+)/g;
const SEPARATOR = /^(?:&&|\|\||[;|&\n])$/;
const SCRIPT_WORD = /^\w[\w.:@+-]*$/;
const UNESCAPE = /\\(.)/g;

const programNameOf = ({ text }: Params): string => text.split('/').filter(Boolean).at(-1) ?? text;

const unquotedShellWord = ({ text }: Params): string =>
  Array.from(text.matchAll(WORD_PART), (part) =>
    part[1] === undefined ? (part[2] ?? part[3] ?? part[4] ?? '') : part[1].replace(UNESCAPE, '$1'),
  ).join('');

const shellTokensOf = ({ text }: Params): ReadonlyArray<string> => {
  const tokens: Array<string> = [];
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(text); match !== null; match = TOKEN.exec(text)) {
    const token = match[1];
    if (token === undefined) {
      break;
    }
    tokens.push(SEPARATOR.test(token) ? token : unquotedShellWord({ text: token }));
  }
  return tokens;
};

const commandStepsOf = ({ text }: Params): ReadonlyArray<ReadonlyArray<string>> => {
  const steps: Array<Array<string>> = [[]];
  for (const token of shellTokensOf({ text })) {
    if (SEPARATOR.test(token)) {
      steps.push([]);
      continue;
    }
    steps.at(-1)?.push(token);
  }
  return steps.map((step) => {
    const start = step.findIndex((token) => !token.includes('='));
    return start === -1 ? [] : step.slice(start);
  });
};

const shellPayloadOf = ({ tokens }: UnwrapParams): string | null => {
  const [program, ...rest] = tokens;
  if (program === undefined || !SHELLS.has(programNameOf({ text: program }))) {
    return null;
  }
  const flag = rest.findIndex((token) => SHORT_FLAGS.test(token) && token.includes('c'));
  return flag === -1 ? null : (rest[flag + 1] ?? null);
};

const scriptWordsOf = ({ tokens }: UnwrapParams): ReadonlyArray<string> => {
  const words: Array<string> = [];
  let index = 0;
  while (index < tokens.length && words.length < MAX_SCRIPT_WORDS) {
    const token = tokens[index] ?? '';
    index += 1;
    if (VALUE_OPTIONS.has(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) {
      if (words.length > 0) {
        break;
      }
      continue;
    }
    if (!SCRIPT_WORD.test(token)) {
      break;
    }
    words.push(token);
  }
  return words;
};

const wordsOfSteps = ({ text, depth }: StepsParams): string | null => {
  const steps = commandStepsOf({ text });
  const tokens =
    steps.find((step) => step.length > 0 && !SETUP_PROGRAMS.has(step[0] ?? '')) ??
    steps.find((step) => step.length > 0) ??
    [];
  const payload = shellPayloadOf({ tokens });
  if (payload !== null && depth < MAX_SHELL_DEPTH) {
    return wordsOfSteps({ text: payload, depth: depth + 1 });
  }
  const [program, ...rest] = tokens;
  if (program === undefined) {
    return null;
  }
  const name = programNameOf({ text: program });
  if (!SCRIPT_RUNNERS.has(name)) {
    return name;
  }
  return [name, ...scriptWordsOf({ tokens: rest })].join(' ');
};

export const commandWordsOf = ({ text }: Params): string | null => wordsOfSteps({ text, depth: 0 });
