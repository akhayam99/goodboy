type TruncateParams = {
  readonly text: string;
  readonly limit: number;
};

type SplitParams = {
  readonly text: string;
};

const splitUnits = ({ text }: SplitParams): ReadonlyArray<string> => {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      (part) => part.segment,
    );
  }
  return Array.from(text);
};

export const middleTruncate = ({ text, limit }: TruncateParams): string => {
  if (text.length <= limit) {
    return text;
  }
  const units = splitUnits({ text });
  if (units.length <= limit) {
    return text;
  }
  const keep = Math.floor((limit - 1) / 2);
  return `${units.slice(0, keep).join('')}…${units.slice(units.length - keep).join('')}`;
};
