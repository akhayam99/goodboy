type Params = {
  readonly sourceText: string;
  readonly title: string;
};

const LEADING_H1_RE = /^(?:[^\S\n]*\n)*#[^\S\n]+([^\n]*)(?:\n|$)/;

const normalize = ({ value }: { readonly value: string }): string =>
  value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

export const dropLeadingTitleHeading = ({ sourceText, title }: Params): string => {
  const match = sourceText.match(LEADING_H1_RE);
  if (match === null) {
    return sourceText;
  }
  const wanted = normalize({ value: title });
  if (wanted === '') {
    return sourceText;
  }
  if (normalize({ value: match[1] ?? '' }) !== wanted) {
    return sourceText;
  }
  return sourceText.slice(match[0].length).replace(/^(?:[^\S\n]*\n)+/, '');
};
