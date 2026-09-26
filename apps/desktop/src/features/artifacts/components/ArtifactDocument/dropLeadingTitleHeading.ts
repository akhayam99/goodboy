type Params = {
  readonly sourceText: string;
  readonly title: string;
};

const LEADING_H1_RE = /^(?:[^\S\n]*\n)*#[^\S\n]+([^\n]*)(?:\n|$)/;

const SHARED_WORDS_MIN = 0.6;

const words = ({ value }: { readonly value: string }): ReadonlyArray<string> =>
  value
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((word) => word.length > 0);

type EchoParams = {
  readonly heading: string;
  readonly title: string;
};

const echoesTitle = ({ heading, title }: EchoParams): boolean => {
  const headingWords = words({ value: heading });
  const titleWords = new Set(words({ value: title }));
  if (headingWords.length === 0 || titleWords.size === 0) {
    return false;
  }
  const shared = headingWords.filter((word) => titleWords.has(word)).length;
  return shared / headingWords.length >= SHARED_WORDS_MIN;
};

export const dropLeadingTitleHeading = ({ sourceText, title }: Params): string => {
  const match = sourceText.match(LEADING_H1_RE);
  if (match === null) {
    return sourceText;
  }
  if (!echoesTitle({ heading: match[1] ?? '', title })) {
    return sourceText;
  }
  return sourceText.slice(match[0].length).replace(/^(?:[^\S\n]*\n)+/, '');
};
