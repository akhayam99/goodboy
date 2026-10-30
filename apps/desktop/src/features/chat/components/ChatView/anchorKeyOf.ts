import type { TranscriptItem } from '../../utils/transcript-items';

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
};

export const anchorKeyOf = ({ items }: Params): string | null => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item === undefined) {
      continue;
    }
    if ((item.kind === 'user_text' && item.isOperatorEcho !== true) || item.kind === 'handoff') {
      return item.key;
    }
  }
  return null;
};
