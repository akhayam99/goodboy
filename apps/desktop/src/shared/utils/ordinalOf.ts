const SUFFIX_OF_LAST_DIGIT: Readonly<Record<number, string>> = { 1: 'st', 2: 'nd', 3: 'rd' };

const FIRST_TEEN = 11;
const LAST_TEEN = 13;

type Params = {
  readonly n: number;
};

export const ordinalOf = ({ n }: Params): string => {
  const hundred = n % 100;
  const isTeen = hundred >= FIRST_TEEN && hundred <= LAST_TEEN;
  return `${n}${isTeen ? 'th' : (SUFFIX_OF_LAST_DIGIT[n % 10] ?? 'th')}`;
};
