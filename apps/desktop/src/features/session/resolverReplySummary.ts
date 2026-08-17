import { markdownPreview } from '../../shared/utils/markdownPreview';

type Params = {
  readonly text: string;
};

const SENTENCE_END = /(?<=[.!?])\s/;

export const resolverReplySummary = ({ text }: Params): string => {
  const flat = markdownPreview({ text });
  if (flat === '') {
    return '';
  }
  return flat.split(SENTENCE_END)[0] ?? flat;
};
