import { NAMES } from '../../shared/utils/names';
import { commandWordsOf } from './commandWordsOf';

export type LastTool = Readonly<{
  name: string;
  command: string | null;
  path: string | null;
}>;

type Params = {
  readonly tool: LastTool | null;
  readonly project: string | null;
  readonly hasToolCall?: boolean;
  readonly canSeeTools?: boolean;
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

export const workingPhraseOf = ({
  tool,
  project,
  hasToolCall = true,
  canSeeTools = true,
}: Params): string => {
  if (tool === null) {
    if (!canSeeTools) {
      return 'Working';
    }
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
  if (name === 'tool') {
    return 'Using a tool';
  }
  return `Using ${tool.name}`;
};
