const SUMMARY_OPEN = '<<summary>>';
const SUMMARY_CLOSE = '<</summary>>';
const MAX_LEAD_CHARS = 200;

type Params = {
  readonly kind: string;
  readonly sourceText: string;
};

type TextParams = {
  readonly text: string;
};

const summaryBlockOf = ({ text }: TextParams): string | null => {
  const open = text.indexOf(SUMMARY_OPEN);
  if (open < 0) {
    return null;
  }
  const from = open + SUMMARY_OPEN.length;
  const close = text.indexOf(SUMMARY_CLOSE, from);
  return close < 0 ? text.slice(from) : text.slice(from, close);
};

const firstParagraphOf = ({ text }: TextParams): string | null => {
  for (const paragraph of text.split('\n\n')) {
    const trimmed = paragraph.trim();
    if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('<<')) {
      return trimmed;
    }
  }
  return null;
};

const plainOf = ({ text }: TextParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
    .replaceAll('*', '')
    .replaceAll('`', '')
    .split(' ')
    .filter((word) => word.length > 0)
    .join(' ');

export const artifactLeadOf = ({ kind, sourceText }: Params): string | null => {
  if (kind !== 'report') {
    return null;
  }
  const block = summaryBlockOf({ text: sourceText });
  const paragraph = firstParagraphOf({ text: block ?? sourceText });
  if (paragraph === null) {
    return null;
  }
  const plain = plainOf({ text: paragraph });
  if (plain.length === 0) {
    return null;
  }
  return plain.length > MAX_LEAD_CHARS ? `${plain.slice(0, MAX_LEAD_CHARS).trimEnd()}...` : plain;
};
