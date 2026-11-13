import { CLOSING_KEYWORDS } from '../../github/closingKeywords';
import type { HostLinkedIssue } from './types';

type Params = {
  readonly body: string;
};

export const linkedIssuesOfBody = ({ body }: Params): ReadonlyArray<HostLinkedIssue> => {
  const numbers = new Set<number>();
  for (const match of body.matchAll(
    new RegExp(`\\b(?:${CLOSING_KEYWORDS})[ \\t]+#(\\d{1,9})\\b`, 'gi'),
  )) {
    numbers.add(Number(match[1]));
  }
  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => ({
      key: `#${number}`,
      label: `#${number}`,
      title: '',
      isClosing: true,
    }));
};
