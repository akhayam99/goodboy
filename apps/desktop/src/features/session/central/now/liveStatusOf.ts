export type LiveStatus = Readonly<{
  word: string;
  reason: string | null;
}>;

type Params = {
  readonly word: string;
  readonly detail: string | null;
};

type TextParams = {
  readonly text: string;
};

const WORD_SEPARATOR = ': ';

const capitalOf = ({ text }: TextParams): string =>
  text === '' ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const liveStatusOf = ({ word, detail }: Params): LiveStatus => {
  const split = word.indexOf(WORD_SEPARATOR);
  if (split > 0) {
    return {
      word: word.slice(0, split),
      reason: capitalOf({ text: word.slice(split + WORD_SEPARATOR.length) }),
    };
  }
  if (detail === null || detail === word) {
    return { word, reason: null };
  }
  const tail = detail.startsWith(`${word}, `) ? detail.slice(word.length + 2) : detail;
  return { word, reason: capitalOf({ text: tail }) };
};
