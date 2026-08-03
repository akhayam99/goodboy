import { markdownPreview } from '../../shared/utils/markdownPreview';

type Params = {
  readonly text: string;
};

const MAX_LENGTH = 120;

const SENTENCE_END = /(?<=[.!?])\s/;

export const resolverReplySummary = ({ text }: Params): string => {
  const flat = markdownPreview({ text });
  if (flat === '') {
    return '';
  }
  const first = flat.split(SENTENCE_END)[0] ?? flat;
  if (first.length <= MAX_LENGTH) {
    return first;
  }
  return `${first.slice(0, MAX_LENGTH).trimEnd()}...`;
};
