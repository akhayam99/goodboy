import { NAMES } from '../../shared/utils/names';

export type LastTool = Readonly<{
  name: string;
  command: string | null;
  path: string | null;
}>;

type Params = {
  readonly tool: LastTool | null;
  readonly project: string | null;
  readonly hasToolCall?: boolean;
};

const SHELL_TOOLS: ReadonlySet<string> = new Set(['bash', 'shell', 'exec', 'command']);
const READ_TOOLS: ReadonlySet<string> = new Set(['read', 'view', 'open']);
const EDIT_TOOLS: ReadonlySet<string> = new Set(['edit', 'write', 'multiedit', 'apply_patch']);
const SEARCH_TOOLS: ReadonlySet<string> = new Set(['grep', 'glob', 'search', 'codebase_search']);
const WEB_TOOLS: ReadonlySet<string> = new Set(['webfetch', 'websearch', 'web_search']);
const SETUP_PROGRAMS: ReadonlySet<string> = new Set(['cd', 'export', 'source', 'set']);
const MAX_SCRIPT_WORDS = 2;
const CHAIN = /&&|\|\||;/;
const SCRIPT_WORD = /^\w[\w.:@+-]*$/;
const PATH_WORD = /^[\w./@~-]+$/;

type TextParams = {
  readonly text: string;
};

const basenameOf = ({ text }: TextParams): string => text.split('/').filter(Boolean).at(-1) ?? text;

const commandTokensOf = ({ text }: TextParams): ReadonlyArray<string> => {
  const tokens = (text.split('|')[0] ?? '').trim().split(/\s+/);
  const start = tokens.findIndex((token) => token !== '' && !token.includes('='));
  return start === -1 ? [] : tokens.slice(start);
};

const scriptWordOf = ({ text }: TextParams): string | null => {
  if (SCRIPT_WORD.test(text)) {
    return text;
  }
  if (text.includes('/') && PATH_WORD.test(text)) {
    return basenameOf({ text });
  }
  return null;
};

const commandWordsOf = ({ text }: TextParams): string | null => {
  const firstLine = text.split('\n').find((line) => line.trim() !== '') ?? '';
  const steps = firstLine.split(CHAIN).map((step) => commandTokensOf({ text: step }));
  const tokens =
    steps.find((step) => step.length > 0 && !SETUP_PROGRAMS.has(step[0] ?? '')) ??
    steps.find((step) => step.length > 0) ??
    [];
  const [program, ...rest] = tokens;
  if (program === undefined) {
    return null;
  }
  const words: Array<string> = [basenameOf({ text: program })];
  for (const token of rest) {
    const word = scriptWordOf({ text: token });
    if (word === null || words.length > MAX_SCRIPT_WORDS) {
      break;
    }
    words.push(word);
  }
  return words.join(' ');
};

export const workingPhraseOf = ({ tool, project, hasToolCall = true }: Params): string => {
  if (tool === null) {
    return hasToolCall ? 'Writing the answer' : NAMES.noToolCallYet;
  }
  const name = tool.name.toLowerCase();
  const where = project === null ? '' : ` in ${project}`;
  if (SHELL_TOOLS.has(name)) {
    const words = tool.command === null ? null : commandWordsOf({ text: tool.command });
    return words === null ? `Running a command${where}` : `Running ${words}${where}`;
  }
  if (READ_TOOLS.has(name) && tool.path !== null) {
    return `Reading ${basenameOf({ text: tool.path })}`;
  }
  if (EDIT_TOOLS.has(name) && tool.path !== null) {
    return `Editing ${basenameOf({ text: tool.path })}`;
  }
  if (SEARCH_TOOLS.has(name)) {
    return 'Searching the code';
  }
  if (WEB_TOOLS.has(name)) {
    return 'Searching the web';
  }
  return `Using ${tool.name}`;
};
