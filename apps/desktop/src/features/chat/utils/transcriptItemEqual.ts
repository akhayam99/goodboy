import type { TranscriptItem } from './transcript-items';

type ItemPair = {
  readonly previous: TranscriptItem;
  readonly next: TranscriptItem;
};

type ItemsPair = {
  readonly previous: ReadonlyArray<TranscriptItem>;
  readonly next: ReadonlyArray<TranscriptItem>;
};

export const transcriptItemEqual = ({ previous, next }: ItemPair): boolean => {
  if (previous === next) {
    return true;
  }
  if (previous.kind !== next.kind || previous.key !== next.key) {
    return false;
  }
  if (previous.kind === 'tool_call' && next.kind === 'tool_call') {
    return (
      previous.ended === next.ended &&
      previous.isError === next.isError &&
      previous.output === next.output &&
      previous.endedAt === next.endedAt
    );
  }
  if (previous.kind === 'assistant_text' && next.kind === 'assistant_text') {
    return previous.text === next.text;
  }
  if (previous.kind === 'artifact_block' && next.kind === 'artifact_block') {
    return (
      previous.complete === next.complete &&
      previous.artifactKind === next.artifactKind &&
      previous.title === next.title
    );
  }
  if (previous.kind === 'usage' && next.kind === 'usage') {
    return previous.at === next.at && previous.usage === next.usage;
  }
  return true;
};

export const transcriptItemsEqual = ({ previous, next }: ItemsPair): boolean => {
  if (previous === next) {
    return true;
  }
  if (previous.length !== next.length) {
    return false;
  }
  return previous.every((item, index) => {
    const other = next[index];
    return other !== undefined && transcriptItemEqual({ previous: item, next: other });
  });
};
