import { CLOSING_KEYWORDS } from './closingKeywords';

type Params = {
  readonly body: string;
};

const STANDALONE_LINE = new RegExp(`^(?:${CLOSING_KEYWORDS})\\s+#(\\d+)\\.?$`, 'i');

export const closingReferenceLines = ({ body }: Params): ReadonlySet<number> => {
  const numbers = new Set<number>();
  for (const line of body.split('\n')) {
    const match = STANDALONE_LINE.exec(line.trim());
    if (match === null) {
      continue;
    }
    numbers.add(Number.parseInt(match[1]!, 10));
  }
  return numbers;
};
