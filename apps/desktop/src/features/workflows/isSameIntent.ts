const NON_WORD_PATTERN = /[^\p{L}\p{N}]+/gu;

type TextParams = {
  readonly text: string;
};

const normalizedOf = ({ text }: TextParams): string =>
  text.normalize('NFKC').toLowerCase().replace(NON_WORD_PATTERN, ' ').trim();

type Params = {
  readonly left: string;
  readonly right: string;
};

export const isSameIntent = ({ left, right }: Params): boolean => {
  const normalized = normalizedOf({ text: left });
  return normalized !== '' && normalized === normalizedOf({ text: right });
};
