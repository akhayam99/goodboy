import type { LastTool } from '../../live-state/workingPhraseOf';
import { toolCommandOf } from './toolCommandOf';
import { toolFilePath } from './toolFilePath';
import type { TranscriptItem } from './transcript-items';

type Params = {
  readonly lastItem: TranscriptItem | undefined;
};

export const lastToolOf = ({ lastItem }: Params): LastTool | null => {
  if (lastItem?.kind === 'tool_call' && !lastItem.ended) {
    return {
      name: lastItem.toolName,
      command: toolCommandOf({ input: lastItem.input }),
      path: toolFilePath({ input: lastItem.input }),
    };
  }
  if (lastItem?.kind === 'file_edit') {
    return { name: 'Edit', command: null, path: lastItem.path };
  }
  return null;
};
