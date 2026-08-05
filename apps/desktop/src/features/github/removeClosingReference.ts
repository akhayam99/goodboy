import { CLOSING_KEYWORDS } from './closingKeywords';

type Params = {
  readonly body: string;
  readonly number: number;
};

export const removeClosingReference = ({ body, number }: Params): string => {
  const line = new RegExp(`^(?:${CLOSING_KEYWORDS})\\s+#${number}\\.?$`, 'i');
  const kept = body.split('\n').filter((candidate) => !line.test(candidate.trim()));
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
};
