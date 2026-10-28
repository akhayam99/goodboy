const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

const MIN_WORD_LENGTH = 3;

const STEM_LENGTH = 5;

const SAME_INTENT_RATIO = 0.6;

type TextParams = {
  readonly text: string;
};

const stemsOf = ({ text }: TextParams): ReadonlySet<string> =>
  new Set(
    (text.toLowerCase().match(WORD_PATTERN) ?? [])
      .filter((word) => word.length >= MIN_WORD_LENGTH)
      .map((word) => word.slice(0, STEM_LENGTH)),
  );

type Params = {
  readonly left: string;
  readonly right: string;
};

export const isSameIntent = ({ left, right }: Params): boolean => {
  const leftStems = stemsOf({ text: left });
  const rightStems = stemsOf({ text: right });
  if (leftStems.size === 0 || rightStems.size === 0) {
    return false;
  }
  const shared = [...leftStems].filter((stem) => rightStems.has(stem)).length;
  const union = leftStems.size + rightStems.size - shared;
  return shared / union >= SAME_INTENT_RATIO;
};
