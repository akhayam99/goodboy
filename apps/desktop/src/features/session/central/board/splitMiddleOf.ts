const MIDDLE_TAIL_CHARS = 14;

const MIDDLE_MIN_CHARS = 28;

type Params = {
  readonly text: string;
};

export const splitMiddleOf = ({
  text,
}: Params): { readonly head: string; readonly tail: string } =>
  text.length < MIDDLE_MIN_CHARS
    ? { head: text, tail: '' }
    : { head: text.slice(0, -MIDDLE_TAIL_CHARS), tail: text.slice(-MIDDLE_TAIL_CHARS) };
