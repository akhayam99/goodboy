import type { LastTool } from '../../live-state/workingPhraseOf';
import { toolFilePath } from './toolFilePath';
import type { TranscriptItem } from './transcript-items';

type Params = {
  readonly lastItem: TranscriptItem | undefined;
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

export const lastToolOf = ({ lastItem }: Params): LastTool | null => {
  if (lastItem?.kind === 'tool_call' && !lastItem.ended) {
    return {
      name: lastItem.toolName,
      command: commandOf({ input: lastItem.input }),
      path: toolFilePath({ input: lastItem.input }),
    };
  }
  if (lastItem?.kind === 'file_edit') {
    return { name: 'Edit', command: null, path: lastItem.path };
  }
  return null;
};
