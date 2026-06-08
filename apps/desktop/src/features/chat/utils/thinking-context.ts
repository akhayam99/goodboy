import type { TranscriptItem } from './transcript-items';

export type ThinkingContext = 'think' | 'search' | 'edit' | 'run';

const TOOL_CONTEXT: ReadonlyArray<readonly [RegExp, ThinkingContext]> = [
  [/edit|write|patch|apply|create|replace|insert|modif/i, 'edit'],
  [/read|grep|glob|search|find|list|cat|fetch|lookup/i, 'search'],
];

export const classifyThinkingContext = ({
  lastItem,
}: {
  lastItem: TranscriptItem | undefined;
}): ThinkingContext => {
  if (lastItem?.kind === 'file_edit') return 'edit';
  if (lastItem?.kind === 'tool_call') {
    for (const [pattern, ctx] of TOOL_CONTEXT) {
      if (pattern.test(lastItem.toolName)) return ctx;
    }
    return 'run';
  }
  return 'think';
};
