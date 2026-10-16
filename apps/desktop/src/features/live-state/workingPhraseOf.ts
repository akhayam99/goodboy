export type LastTool = Readonly<{
  name: string;
  command: string | null;
  path: string | null;
}>;

type Params = {
  readonly tool: LastTool | null;
  readonly project: string | null;
};

const SHELL_TOOLS: ReadonlySet<string> = new Set(['bash', 'shell', 'exec', 'command']);
const READ_TOOLS: ReadonlySet<string> = new Set(['read', 'view', 'open']);
const EDIT_TOOLS: ReadonlySet<string> = new Set(['edit', 'write', 'multiedit', 'apply_patch']);
const SEARCH_TOOLS: ReadonlySet<string> = new Set(['grep', 'glob', 'search', 'codebase_search']);
const WEB_TOOLS: ReadonlySet<string> = new Set(['webfetch', 'websearch', 'web_search']);

type TextParams = {
  readonly text: string;
};

const basenameOf = ({ text }: TextParams): string => text.split('/').filter(Boolean).at(-1) ?? text;

const programOf = ({ text }: TextParams): string | null => {
  const word = text
    .trim()
    .split(/\s+/)
    .find((token) => token !== '' && !token.includes('='));
  return word === undefined ? null : basenameOf({ text: word });
};

export const workingPhraseOf = ({ tool, project }: Params): string => {
  if (tool === null) {
    return 'Writing the answer';
  }
  const name = tool.name.toLowerCase();
  const where = project === null ? '' : ` in ${project}`;
  if (SHELL_TOOLS.has(name)) {
    const program = tool.command === null ? null : programOf({ text: tool.command });
    return program === null ? `Running a command${where}` : `Running ${program}${where}`;
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
