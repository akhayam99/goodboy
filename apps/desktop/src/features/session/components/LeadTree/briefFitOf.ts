type Params = {
  readonly text: string;
  readonly maxWidth: number;
  readonly measure: (text: string) => number;
};

const ELLIPSIS = '…';

export const briefFitOf = ({ text, maxWidth, measure }: Params): string => {
  if (maxWidth <= 0 || measure(text) <= maxWidth) {
    return text;
  }
  const words = text.split(' ');
  for (let count = words.length - 1; count >= 1; count -= 1) {
    const candidate = `${words.slice(0, count).join(' ')}${ELLIPSIS}`;
    if (measure(candidate) <= maxWidth) {
      return candidate;
    }
  }
  return text;
};
