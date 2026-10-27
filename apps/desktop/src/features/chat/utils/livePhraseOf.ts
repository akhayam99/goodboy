import { workingPhraseOf, type LastTool } from '../../live-state/workingPhraseOf';
import { toolFilePath } from './toolFilePath';
import type { TranscriptItem } from './transcript-items';

export const THINKING_PHRASE = 'Thinking';

export const WRITING_PHRASE = 'Writing the answer';

type Params = {
  readonly lastItem: TranscriptItem | undefined;
  readonly project: string | null;
};

type InputParams = {
  readonly input: unknown;
};

const commandOf = ({ input }: InputParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, 'command');
  return typeof value === 'string' && value.length > 0 ? value : null;
};

type ToolParams = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
};

const toolOf = ({ item }: ToolParams): LastTool => ({
  name: item.toolName,
  command: commandOf({ input: item.input }),
  path: toolFilePath({ input: item.input }),
});

export const livePhraseOf = ({ lastItem, project }: Params): string => {
  if (lastItem?.kind === 'tool_call' && !lastItem.ended) {
    return workingPhraseOf({ tool: toolOf({ item: lastItem }), project });
  }
  if (lastItem?.kind === 'file_edit') {
    return workingPhraseOf({
      tool: { name: 'Edit', command: null, path: lastItem.path },
      project,
    });
  }
  if (lastItem?.kind === 'assistant_text') {
    return WRITING_PHRASE;
  }
  return THINKING_PHRASE;
};
