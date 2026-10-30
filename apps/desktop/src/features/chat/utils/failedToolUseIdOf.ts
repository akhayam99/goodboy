import type { ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly runId: ProviderRunId | undefined;
};

export const failedToolUseIdOf = ({ items, runId }: Params): string | null => {
  if (runId === undefined) {
    return null;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind === 'tool_call' && item.runId === runId && item.isError) {
      return item.toolUseId;
    }
  }
  return null;
};
